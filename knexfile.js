// 수요조사 시간, 예약에 필요한 정보 등은 config에서 사용하고 있으므로 db 전용 설정 파일을 또 쓰기보다는
// db 설정 관련된 내용을 config가 들고 있게 하고 그걸 가져오는 게 더 관리하기에 편하다.
module.exports = require('config').get('db');

