const Promise = require('bluebird');
const puppeteer = require('puppeteer');
const config = require('config');
const db = require('./db');
const {addDays, dateToString} = require('./date_utils');

/**
 * @param {object} sharedState
 * @noreturns
 */
async function reserve() {
  const reserveDate = dateToString(addDays(new Date(), 3));
  const attendCount = await db('rsvp').where(
      {study_date: reserveDate, attending: 1}
  ).count('*');
  // 4명 미만이면 스터디 진행 안함
  if (attendCount[0]['count(*)'] < 4) {
    return '';
  }
  const optionId = attendCount[0]['count(*)'] >= 6? '27712' : '27711';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setViewport({width: 1920, height: 1080});
  // Q. 왜 이렇게 줄줄이 await이죠?
  // A. 전부 async function이라서 실행하고 나서 완료가 별도로 있음
  // 완료가 될 때까지 await으로 기다려야 함
  // await이 없으면? 예를 들어 일단 로그인 버튼 클릭하고 응답 안 기다리고
  // 곧바로 다른 버튼(아직 생성되지도 않았을) 버튼을 누르는 참사가 일어날 수 있음
  try {
    await page.goto('https://spacecloud.kr/space/16034', {delay: 2000});
    await Promise.delay(500);
    await page.click(`li[_productid=\"${optionId}\"]`);
    await Promise.delay(300);
    await page.click('.detail_contact_footer ._gotoReservation');
    await Promise.delay(500);
    await page.waitForSelector('a.btn_naver.btn_login');
    await page.click('a.btn_naver.btn_login');
    await Promise.delay(600);
    await page.focus('#id.int');
    await page.keyboard.type(config.get('reservation.user_id'), {delay: 300});
    await Promise.delay(300);
    await page.focus('#pw.int');
    await page.keyboard.type(config.get('reservation.password'), {delay: 300});
    await Promise.delay(300);
    await page.waitForSelector('.btn_global');
    await Promise.delay(300);
    await page.click('.btn_global');
    // console.log(page.url());
    // await page.waitForNavigation();
    await page.waitForSelector('.btn_cancel');
    await Promise.delay(300);
    await page.click('.btn_cancel');
    await Promise.delay(300);
    console.log('cancel 성공');
    await page.waitForSelector('#name');
    await Promise.delay(300);
    await page.click('#name');
    for (let i=0; i<3; i++) {
      await page.keyboard.press('Backspace');
    }
    await Promise.delay(300);
    await page.keyboard.type(`${config.get('reservation.name')}`, {delay: 100});
    await Promise.delay(300);
    await page.click(`td[_ymd=\"${reserveDate}\"]`, {delay: 2000});
    await page.click('li[_tm=\"15\"]');
    await page.mouse.move(0, 0);
    await Promise.delay(100);
    await page.click('li[_tm=\"20\"] .price');
    await page.click('li[_tm=\"20\"] .price');
    await Promise.delay(100);
    await page.click('li[_tm=\"21\"] .price');
    console.log('move');
    await Promise.delay(300);
    console.log('timeselect');
    // await을 쓰면 then을 쓰지 않아도 원하는 내용물을 밖으로 꺼내준다.
    const element = await page.$$('#_totalPrice');
    const totalPrice = parseInt(element[0].innerText.replace(',', ''));
    await page.click('#_agreeEl .option', {delay: 2000});
    await Promise.delay(300);
    await page.click('div.static > a.btn', {delay: 2000});
    await page.click('div.btns > a._do_reserve', {delay: 2000});
    await db('round_info').insert({study_date: reserveDate, price: totalPrice});
    console.log('끝');
  } catch (e) {
    console.error(e);
    await page.screenshot({path: 'fail.png'});
  } finally {
    browser.close();
  }
}

module.exports = {
  reserve,
};
