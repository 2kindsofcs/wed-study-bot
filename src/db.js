// 여러 파일이 db에 연결해서 db를 쓰고 싶어하므로, 모듈을 따로 만든다.
// 헷갈리면 안 되는 게, 'knex'패키지 자체가 필요한 게 아니라 함수의 결과값이 필요한 것이다.

module.exports = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './dev.sqlite3',
  },
});
