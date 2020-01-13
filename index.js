const myToken = '995308759:AAG0cSOOdlAP8r3n6tnaXtBx0wArse89YDA';
const port = "5010";

const telegraf = require('telegraf');
const composer = require('telegraf/composer');
const session = require('telegraf/session');
const stage = require('telegraf/stage');
const markup = require('telegraf/markup');
const wizardScene = require('telegraf/scenes/wizard');
const { Client } = require('pg');
const extra = require('telegraf/extra');
const applicationURL = 'https://heroku-telegram-bots.herokuapp.com:443';

const successMsg = extra
  .markdown().markup((msg) => msg.inlineKeyboard([
    msg.callbackButton('Текущий баланс', 'balance'),
    msg.callbackButton('Создать карточку', 'createCard')
  ]));

const createCardMsg = extra
  .markdown().markup((msg) => msg.inlineKeyboard([
    msg.callbackButton('Сегодня', 'today'),
    msg.callbackButton('Календарь', 'calendar'),
    msg.callbackButton('Отмена', 'cancel')
  ]));