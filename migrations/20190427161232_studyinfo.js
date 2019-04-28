
exports.up = function(knex, Promise) {
  // 테이블을 2개 만들고 싶은 것이므로 return something 하는 게 아니라
  // Promise.all을 사용하여 각각의 테이블이 다 완성되고 나면 프로미스를 리턴
  return Promise.all([
    knex.schema.createTable('round_info',
        (t) => {
          t.dateTime('study_date').primary();
          t.integer('price').nullable();
        }
    ),
    knex.schema.createTable('rsvp',
        (t) => {
          t.dateTime('study_date');
          t.string('member_name');
          t.boolean('attending').nullable();
          // 이넘을 써서 처리할 수도 있음.
          // 하지만 이넘으로 설정된 칼럼은 varchar(255)을 사용한다.
          // t.enu('attend', ['yes', 'no', 'no_response']);
          t.primary(['study_date', 'member_name']);
        }
    ),
  ]);
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTable('round_info'),
    knex.schema.dropTable('rsvp'),
  ]);
};
