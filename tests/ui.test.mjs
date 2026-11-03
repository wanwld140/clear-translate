import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const own='[data-clear-translate]';
async function snapshot(page){
  return page.locator('body').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('[data-clear-translate]').forEach(n=>n.remove());return copy.innerHTML;});
}

export async function runUiRegression(options={}){
  const work=path.join(root,'work');await fs.mkdir(work,{recursive:true});
  const profile=await fs.mkdtemp(path.join(work,'ui-regression-'));
  const extension=path.join(root,'extension');
  const executablePath=options.executablePath||globalThis.process?.env.CLEAR_TRANSLATE_CHROMIUM||chromium.executablePath();
  const context=await chromium.launchPersistentContext(profile,{executablePath,headless:true,args:['--headless=new',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:1000}});
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const html=await fs.readFile(path.join(root,'tests/fixtures/github-ui.html'),'utf8');
    await context.route('https://github.com/clear-translate-ui-test',r=>r.fulfill({contentType:'text/html',body:html}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://github.com/clear-translate-ui-test');
    await worker.evaluate(async()=>{
      for(let i=0;i<50&&!chrome.storage;i++)await new Promise(r=>setTimeout(r,20));
      await chrome.storage.local.set({engine:'microsoft',autoEnglish:false});
      globalThis.testRequests=[];globalThis.testDelay=20;
      globalThis.fetch=async(url,options)=>{
        if(!String(url).startsWith('https://edge.microsoft.com/translate/'))throw new Error('Unexpected network request');
        const texts=JSON.parse(options.body);testRequests.push(...texts);
        await new Promise(r=>setTimeout(r,testDelay));
        return new Response(JSON.stringify(texts.map(text=>({translations:[{text:`译文：${text}`,to:'zh-Hans'}]}))),{status:200});
      };
    });
    await page.reload();
    await page.evaluate(()=>window.testSource=document.querySelector('#profile .menu-label').firstChild);
    const original=await snapshot(page);
    await page.locator('button.orb').click();
    await page.locator('#profile .translation').waitFor({timeout:5000});
    assert.equal(await page.locator('#profile .translation').textContent(),'个人资料');
    assert.equal(await page.locator('[data-login] '+own).count(),0);
    assert.equal(await page.evaluate(()=>testSource===document.querySelector('#profile .menu-label').firstChild),true);
    const bounds=await page.locator('.menu-link').evaluateAll(links=>links.map(link=>{
      const host=link.querySelector('[data-clear-translate]');if(!host)return true;
      const a=link.getBoundingClientRect(),b=host.getBoundingClientRect();
      return a.height===36&&(b.width===0||(b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1));
    }));
    assert.ok(bounds.every(Boolean),'菜单译文越过点击区域或改变固定行高');
    await page.locator('#profile').click();assert.equal(await page.evaluate(()=>clicks),1);
    assert.equal(await page.locator('#name').getAttribute('placeholder'),'Enter your display name');
    assert.ok(!(await worker.evaluate(()=>testRequests)).includes('Enter your display name'),'关闭弹层中的placeholder被发送');

    await page.locator('#modal-open').click();
    await page.locator('#first p .translation').waitFor({timeout:3000});
    await page.locator('#second-open').click();
    await page.locator('#second p .translation').waitFor({timeout:3000});
    assert.equal(await page.locator('#second-close .translation').textContent(),'关闭');
    await page.locator('#second-close').click();await page.locator('#cancel').click();
    await page.locator('#popover-open').click();await page.locator('#pop-save .translation').waitFor({timeout:3000});
    await page.locator('#popover-open').click();
    await page.locator('#details summary').click();await page.locator('#details p .translation').waitFor({timeout:3000});
    await page.locator('#details summary').click();
    await page.locator('button.orb').click();
    assert.equal(await snapshot(page),original,'恢复后原DOM/属性不同');
    assert.equal(await page.locator('.translation').count(),0);

    await page.locator('button.orb').click();await page.locator('#profile .translation').waitFor();
    await page.locator('#modal-open').click();await page.locator('#name').fill('user-entered-value');
    let placeholder=await page.locator('#name').getAttribute('placeholder');
    for(let i=0;i<50&&placeholder==='Enter your display name';i++){
      await page.waitForTimeout(20);placeholder=await page.locator('#name').getAttribute('placeholder');
    }
    assert.match(placeholder,/译文/);assert.equal(await page.locator('#name').inputValue(),'user-entered-value');
    await page.locator('#name').evaluate(el=>el.setAttribute('placeholder','网站主动更新的中文提示'));
    await page.waitForTimeout(150);await page.locator('#cancel').click();
    await page.locator('button.orb').click();
    assert.equal(await page.locator('#name').getAttribute('placeholder'),'网站主动更新的中文提示');
    assert.equal(await page.locator('#name').inputValue(),'user-entered-value');

    await page.locator('button.orb').click();await worker.evaluate(()=>testDelay=350);
    await page.evaluate(()=>{
      const d=document.createElement('dialog');d.id='late';
      d.innerHTML='<p>A unique late modal request.</p><input placeholder="A unique late placeholder"><button id="late-close">Close</button>';
      document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.showModal();
    });
    const requested=await worker.evaluate(async()=>{for(let i=0;i<80&&!testRequests.includes('A unique late modal request.');i++)await new Promise(r=>setTimeout(r,10));return testRequests.includes('A unique late modal request.');});
    assert.equal(requested,true);await page.locator('#late-close').click();await page.waitForTimeout(500);
    assert.equal(await page.locator('#late '+own).count(),0);
    assert.equal(await page.locator('#late input').getAttribute('placeholder'),'A unique late placeholder');
    assert.deepEqual(errors,[]);
    return {menuBounds:true,originalTextAndClick:true,secondaryDialog:true,popover:true,details:true,exactRestore:true,inputValueProtected:true,lateResultDiscarded:true,fixtureOnly:true};
  }finally{await context.close();}
}

const cli=globalThis.process;
if(cli?.argv[1]&&path.resolve(cli.argv[1])===fileURLToPath(import.meta.url)){
  runUiRegression().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);cli.exitCode=1;});
}
