//  node  --inspect-brk  lagou_job_finder.js

const puppeteer = require('puppeteer');
const moment = require('moment');
const JSDOM = require("jsdom").JSDOM;
const jquery = require('jquery');
const sleep = ms =>  new Promise(resolve => { setTimeout(resolve, ms) });

const util = require('util');
const fs = require('fs');
const appendFile = async (file, content) => { 
    await util.promisify(fs.appendFile)(file, content).catch(e => console.log(e)); 
};



const goodKeywords = ["sql","dubbo","linux","gc","垃圾回收","并发","线程","异步","zookeeper","thrift","mysql","flume","hbase","storm","kafka","hadoop","hive"];
const badKeywords = ["微服务","hibernate","socket","nio","资深","源码","算法","数据结构","高并发","211","985"];

let t1 = new moment();

let login_url = 'https://passport.lagou.com';
let username = 'xxxx';
let pw = 'xxxx';


let queryAlready = function(){
  let arr = Array.from(Array(20)).map((x, i)=>i+1).map(i => new Promise( (resolve, reject ) => {
    $.get('https://www.lagou.com/mycenter/delivery.html?tag=-1&r=&pageNo=' + i, function(data) {
        let dom = $(data);
        let companyArr = dom.find(".reset.my_delivery").find('.d_company').map((i, v) => $(v).children().html() );
        resolve( companyArr.get() );
      }
    );
  } ) );
  return Promise.all(arr);
}


let getPositionList = function(page_num){
    return new Promise( ( resolve, reject ) => {
        $.post('https://www.lagou.com/jobs/positionAjax.json?gj=3年及以下%2C不要求&xl=本科&px=default&city=北京&district=海淀区&needAddtionalResult=false', {
          first: 'false', pn: page_num, kd: 'java'
        }, function( data ){
            try { 
                resolve( data.content.positionResult.result.map(x => { return {'id' : x.positionId ,'name' : x.companyShortName}; }  ) );
            } catch (e) { reject(e); }
            
        }).fail(function(){ reject('======== ERROR =======')  });
    });
}

puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    slowMo: 10
}).then( async browser => { 
    global.page = await browser.newPage();
 /*   await page.setRequestInterception(true);
    page.on('request', request => {
		if (request.method().toLowerCase() == 'post') {
			console.log(request.url() , request.headers());
		}
		
        if (['image', 'stylesheet' ].indexOf(request.resourceType()) !== -1) {
            request.abort();
        } else {
            request.continue();
        }
    }); 
    await page.setUserAgent('Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36');
*/
    await page.goto(login_url);
    await page.evaluate( () => $("[data-view='passwordLogin'] [data-propertyname='username'] .input.input_white").focus() );
    await page.keyboard.type(username, {delay: 3});
    await page.evaluate( () => $("[data-view='passwordLogin'] [data-propertyname='password'] .input.input_white").focus() );
    await page.keyboard.type(pw, {delay: 3});
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded'});
    console.log('登录成功');
    
    let already_set = new Set();
    let resultList = await page.evaluate( queryAlready );
    resultList.forEach(x => x.forEach( y => already_set.add( y ) ) );


    let url = 'https://www.lagou.com/jobs/list_java?px=default&gj=3年及以下,不要求&xl=本科&city=北京&district=海淀区#filterBox';
    await page.goto(url);
    /* page.on('console', msg => {
      for (let i = 0; i < msg.args().length; ++i)
        console.log(`${i}: ${msg.args()[i]}`);
    }); */
	
    let max_page = 5;
	
    for (let i = 0; i < max_page; i ++ ) { 
		
        let positionList = await page.evaluate( getPositionList , i+1+'' );
        
        for ( let j = 0; j < positionList.length ; j ++ ) {
            let id = positionList[j].id;
            let companyName = positionList[j].name.trim().toLowerCase();
            let detail_url = 'https://www.lagou.com/jobs/' + id + '.html';
            let detail = await page.evaluate( (detail_url) => new Promise(
                ( resolve, reject ) => {
                    $.get(detail_url, data => resolve(data) ).fail(() => reject('ERROR=========')  );
                }
            ) , detail_url );
            
            let $ = jquery(new JSDOM(detail).window);
            
            let detail_text = ($('#job_detail').text() + $('.job_request').text()).toLowerCase();
            if (detail_text.length == 0) {  console.log('ERROR' + detail_url) }
            let good_number = goodKeywords.reduce( (sum, cur) => sum + detail_text.includes(cur) ,0);
            let bad_number = badKeywords.reduce( (sum, cur) => sum + detail_text.includes(cur) ,0);
            let flag = false;
            already_set.forEach( x => {
                if( x.toLowerCase().includes(companyName) ){
                    flag = true;
                }
            });
            appendFile( 'result.txt', companyName + '\t' + detail_url + '\t' + good_number +'\t' + bad_number + '\t' + flag + '\n' );
            await sleep(800);
        }
        console.log('page ' + i)
    }
    appendFile( 'result.txt', new moment().format() );
    console.log(new moment() - t1 + '======done , please press Ctrl + c ');
});







