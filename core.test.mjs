import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {splitText,parseTranslation,parseProvider,translateOnline,translateBatchOnline} from './extension/core.js';
import {extractParagraphs} from './extension/pdf-text.js';
globalThis.crypto ||= webcrypto;

test('长段落不截断，保留全部非空白字符及完整Unicode',()=>{
  const text=('First sentence. Second sentence with emojis 😀! ').repeat(150);
  const parts=splitText(text);
  assert.ok(parts.length>1 && parts.every(p=>p.length<=1500));
  assert.equal(parts.join('').replace(/\s/g,''),text.replace(/\s/g,''));
  assert.ok(parts.every(p=>!/[\uD800-\uDBFF]$/.test(p)));
});
test('三种服务响应校验及多句合并',()=>{
  assert.equal(parseTranslation([[['第一句。'],['第二句。']]]),'第一句。第二句。');
  assert.equal(parseProvider([{translations:[{text:'中文'}]}],'microsoft'),'中文');
  assert.equal(parseProvider({auto_translation:['中文']},'tencent'),'中文');
  for(const bad of [null,[],[[null]],{html:'blocked'}]) assert.throws(()=>parseTranslation(bad));
  assert.throws(()=>parseProvider({auto_translation:[]},'tencent'));
});
test('HTTP503只重试一次，成功返回真实解析路径',async()=>{
  let calls=0;
  const result=await translateOnline('Hello',{sleep:async()=>{},fetcher:async()=>++calls===1?{ok:false,status:503}:{ok:true,json:async()=>[[['你好']]]}});
  assert.equal(result,'你好'); assert.equal(calls,2);
});
test('429明确失败且不自动重试/换源',async()=>{
  let calls=0;
  await assert.rejects(translateOnline('Hello',{sleep:async()=>{},fetcher:async()=>{calls++;return{ok:false,status:429}}}),/限流/);
  assert.equal(calls,1);
});
test('取消后不再发送请求',async()=>{
  const c=new AbortController(); c.abort(); let calls=0;
  await assert.rejects(translateOnline('Hello',{signal:c.signal,fetcher:async()=>{calls++}}),/取消/);
  assert.equal(calls,0);
});
test('微软/腾讯请求正确源语言、目标语言、无cookie，响应同路径解析',async()=>{
  for(const provider of ['microsoft','tencent']) {
    const result=await translateOnline('Hello',{provider,fetcher:async(url,opts)=>{
      assert.equal(opts.credentials,'omit'); assert.equal(opts.method,'POST');
      assert.ok(!('Authorization' in opts.headers));
      if(provider==='microsoft'){assert.match(url,/to=zh-Hans/);assert.equal(new URL(url).searchParams.has('from'),false);assert.deepEqual(JSON.parse(opts.body),['Hello']);}
      else {const b=JSON.parse(opts.body);assert.equal(b.source.lang,'auto');assert.equal(b.target.lang,'zh');}
      return{ok:true,json:async()=>provider==='microsoft'?[{translations:[{text:'你好'}]}]:{auto_translation:['你好']}};
    }});
    assert.equal(result,'你好');
  }
});
test('X悬停日期不变更时钟或时区，非法日期不猜测',()=>{
  const scope={};vm.runInNewContext(fs.readFileSync('extension/dates.js','utf8'),scope);
  assert.equal(scope.clearTranslateDate('12:18 PM · Oct 28, 2026'),'下午12:18 · 2026年10月28日');
  assert.equal(scope.clearTranslateDate('1:02 AM · Jan 2, 2026 UTC'),'上午1:02 · 2026年1月2日 UTC');
  assert.equal(scope.clearTranslateDate('Oct 99, 2026'),null);
  assert.equal(scope.clearTranslateDate('Just a comment'),null);
});
test('原生批量译文逐段对应，缺条时明确失败',async()=>{
  let calls=0;
  const result=await translateBatchOnline(['First','Second'],{provider:'microsoft',fetcher:async(url,opts)=>{
    calls++; assert.deepEqual(JSON.parse(opts.body),['First','Second']);
    return {ok:true,json:async()=>[{translations:[{text:'第一'}]},{translations:[{text:'第二'}]}]};
  }});
  assert.deepEqual(result,['第一','第二']); assert.equal(calls,1);
  await assert.rejects(translateBatchOnline(['First','Second'],{provider:'microsoft',sleep:async()=>{},fetcher:async()=>({ok:true,json:async()=>[{translations:[{text:'少一条'}]}]})}),/数量/);
});
test('Google多q一次请求逐条对应，原文含换行符也不串段',async()=>{
  let calls=0;
  const texts=['First line\nsecond line','Second paragraph','Last paragraph'];
  const values=await translateBatchOnline(texts,{provider:'google',fetcher:async(url,opts)=>{
    calls++;const u=new URL(url);assert.equal(u.pathname,'/translate_a/t');
    assert.deepEqual(u.searchParams.getAll('q'),texts);assert.equal(opts.credentials,'omit');
    assert.equal(u.searchParams.get('sl'),'auto');
    return{ok:true,json:async()=>['第一段','第二段','第三段']};
  }});
  assert.deepEqual(values,['第一段','第二段','第三段']);assert.equal(calls,1);
});

test('Google自动识别的译文/语言二元组严格按项映射',async()=>{
  const values=await translateBatchOnline(['Bonjour','こんにちは'],{provider:'google',fetcher:async()=>({ok:true,json:async()=>[['你好','fr'],['你好','ja']]})});
  assert.deepEqual(values,['你好','你好']);
  await assert.rejects(translateBatchOnline(['Bonjour','こんにちは'],{provider:'google',sleep:async()=>{},fetcher:async()=>({ok:true,json:async()=>[['你好','fr','extra'],['你好','ja']]})}),/格式/);
});
test('腾讯自动识别逐段请求，不把混合语言塞进同一源语言批次',async()=>{
  const calls=[];
  const values=await translateBatchOnline(['Bonjour','こんにちは'],{provider:'tencent',fetcher:async(url,opts)=>{const body=JSON.parse(opts.body);calls.push(body.source);return{ok:true,json:async()=>({auto_translation:[body.source.text_list[0]==='Bonjour'?'法语译文':'日语译文']})};}});
  assert.deepEqual(values,['法语译文','日语译文']);assert.deepEqual(calls,[{lang:'auto',text_list:['Bonjour']},{lang:'auto',text_list:['こんにちは']}]);
  let count=0;
  await assert.rejects(translateOnline('Текст',{provider:'tencent',fetcher:async()=>{count++;return{ok:true,json:async()=>({header:{ret_code:'error'}})};}}),/暂不支持/);assert.equal(count,1);
});
test('多文字体系识别及中文保护沿用实际内容辅助模块',()=>{
  const scope={};vm.runInNewContext(fs.readFileSync('extension/languages.js','utf8'),scope);const can=scope.clearTranslateLanguage.shouldTranslate;
  for(const t of ['Hello world','Bonjour à tous','こんにちは世界','업데이트 중입니다','Не выключайте питание','لا توقف الجهاز','กรุณารอสักครู่'])assert.equal(can(t),true,t);
  for(const t of ['这是中文内容','中文与 OpenAI 产品介绍','12345 😀','完成'])assert.equal(can(t),false,t);
  assert.equal(can('東京大学','ja-JP'),true);assert.equal(can('東京大学','zh-CN'),false);
  assert.equal(can('Bonjour le monde','fr',true),false);assert.equal(can('Hello world','en',true),true);
});
test('PDF实际文本项按行距分段，标记项不混进正文',()=>{
 const item=(str,x,y,height=12,hasEOL=false)=>({str,width:str.length*6,height,transform:[height,0,0,height,x,y],hasEOL});
 const result=extractParagraphs([item('First',50,700),item('sentence.',84,700,12,true),{type:'beginMarkedContent'},item('Second line.',50,685,12,true),item('Next paragraph.',50,645,12,true),item('Heading',50,610,18,true)]);
 assert.deepEqual(result,['First sentence. Second line.','Next paragraph.','Heading']);
 assert.deepEqual(extractParagraphs([]),[]);
});
