// import하는 애들이랑 다른 코드랑 안 섞이게 (별 수 없는 경우도 있지만 기본적으로는)
// 만약 상수가 있을 경우 import랑 구분되게 따로 밑에다 빼는 게 좋음

const {studyPoll} = require('./study_poll');
const {reserve} = require('./reserve');

/*
isMorethanThree
*/

const sharedState = {
  isMoreThanThree: false,
};

const cron = require('node-cron');
// 인자를 넣은 상태로 함수를 넣어주면 그건 리턴값이지 함수가 아니게 된다!
// 고로 익명함수를 써서 인자를 진짜 원하는 함수에 넣어주면 해 - 결
cron.schedule('20 14 * * sunday', () => studyPoll(sharedState));
cron.schedule('21 14 * * sunday', () => reserve(sharedState));
