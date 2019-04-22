/**
 * 숫자를 2-width 문자열로 만들어 반환합니다.
 * @param {number} num
 * @return {string}
 */
function addZero(num) {
  if (num < 10) {
    return ('0'.concat(num.toString(10)));
  }
  return num.toString(10);
}

/**
 * 8자리 연월일 스트링을 반환합니다.(yyyyMMdd)
 * @param {Date} date
 * @return {string}
 */
function dateToString(date) {
  const year = date.getFullYear().toString(10);
  const month = addZero(date.getMonth() + 1); // 지옥에서 올라온 제로베이스
  const day = addZero(date.getDate());
  const dateString = year + month + day;
  return dateString;
}

/**
 * 주어진 날짜로부터 dayAfter 일 후의 Date 객체를 반환합니다.
 * @param {Date} date
 * @param {number} dayAfter
 * @return {Date}
 */
function addDays(date, dayAfter) {
  const dayToSec = 1000 * 60 * 60 * 24;
  return new Date(date.getTime() + (dayToSec * dayAfter));
}

module.exports = {
  dateToString,
  addDays,
};
