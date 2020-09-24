const moment = require('moment');
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss.sssZ';

const current = () => moment(new Date()).format(DATE_TIME_FORMAT);

const format = (date) => moment(date).format(DATE_TIME_FORMAT);

const addDays = (startDate, days) =>
  moment(startDate, DATE_TIME_FORMAT)
    .add(days, 'days')
    .format(DATE_TIME_FORMAT);

const isGreater = (dateTime) => moment(new Date(), DATE_TIME_FORMAT).isAfter(moment(dateTime, DATE_TIME_FORMAT));

const daysDiff = (date1, date2 = null) => {
  let secondDate = date2;
  if (date2 === null) {
    secondDate = current();
  }
  return moment(date1, DATE_TIME_FORMAT).diff(moment(secondDate, DATE_TIME_FORMAT), 'days') + 1;
};

const isBefore = (dateTime1, dateTime2) => moment(dateTime1).isBefore(moment(dateTime2));

module.exports = {
  current,
  addDays,
  isGreater,
  daysDiff,
  isBefore,
  format,
};
