const myToken = '995308759:AAG0cSOOdlAP8r3n6tnaXtBx0wArse89YDA';
const port = "5010";
const dataBase = "postgres://lfodygkpkxwiut:97c34dfaa384d8fae43c0ad8db1e3acec41a5ba9eb618eb74557116f2e5b8dbf@ec2-54-228-246-214.eu-west-1.compute.amazonaws.com:5432/ddf4globq3eaio";
const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');
const { Client } = require('pg');
const extra = require('telegraf/extra');
const applicationURL = 'https://heroku-telegram-bots.herokuapp.com:443';

const arrCard = [];
const arrDate = [];
const arrLogin = [];

const API_TOKEN = process.env.TOKEN || myToken;
const PORT = process.env.PORT || port;
const URL = process.env.APP_URL || applicationURL;

let client = new Client({
    connectionString: process.env.DATABASE_URL || dataBase,
    ssl: true
});
  
const stepHandler = new Composer();
stepHandler.action('balance', async (ctx) => {
    let userId = ctx.scene.session.state.result[0]
    const resultId = await getBalance(userId)
    ctx.reply(`Текущий баланс: $ ${resultId}. Для продолжения напишите что-нибудь`)
    return ctx.scene.leave()
})
  
stepHandler.action('createCard', (ctx) => {
    ctx.reply(`На какой день хотите создать карточку?`, createExpenseCard)
    return ctx.wizard.next()
})
  
stepHandler.use((ctx) => ctx.replyWithMarkdown('Авторизация прошла успешно', successLogin));

const superWizard = new WizardScene('super-wizard',
    (ctx) => {
      ctx.scene.session.state = {}
      ctx.reply('Введите логин: ');
      return ctx.wizard.next()
    },
  
    (ctx) => {
      ctx.reply('Введите пароль: ');
      ArrToLogin.push(ctx.message.text);
      return ctx.wizard.next()
    },
  
    async (ctx) => {
      arrLogin.push(ctx.message.text);
      Login = arrLogin[0];
      Pass = arrLogin[1];
      const result = await getData(Login, Pass)
      arrLogin.length = 0;
      if (result.length === 4) {
        ctx.scene.session.state = {
          result: result
        }
        ctx.reply('Авторизация прошла успешно', successLogin);
        return ctx.wizard.next()
      } else if (result.length === 0) {
  
        ctx.reply('Неправильный логин и/или пароль, Если хотите повторить попытку,  напишите что-нибудь');
        return ctx.scene.leave()
      }
    },
  
    stepHandler,
  
    (ctx) => {
  
      let callbackData = ctx.update.callback_query.data;
      ctx.scene.session.state.result.push(callbackData);
  
      if (callbackData.toUpperCase() === 'CANCEL') {
        ctx.reply('Авторизация прошла успешно', successLogin);
        return ctx.wizard.back()
      }
      else if (callbackData.toUpperCase() === 'TODAY') {
        ctx.reply('Что записывать в поле Amount?');
        return ctx.wizard.selectStep(6)
      }
      else if (callbackData.toUpperCase() === 'CALENDAR') {
        ctx.reply('Напишите дату в формате YYYY-MM-DD Например: 2012-11-28');
        return ctx.wizard.next()
      }
    }, 
    (ctx) => {
      arrDate.push(ctx.message.text)
      ctx.reply('Что записывать в поле Amount?');
      return ctx.wizard.next()
    }, 
    (ctx) => {
      arrCard.push(ctx.message.text)
      ctx.reply('Что записывать в поле Description?');
      return ctx.wizard.next()
    }, 
    (ctx) => {
      arrCard.push(ctx.message.text)
      let userId = ctx.scene.session.state.result[0];
      let Amount = arrCard[0];
      let Description = arrCard[1];
      let cardDate = new Date().toUTCString();
  
      if (arrDate.length !== 0) {
        cardDate = new Date(arrDate[0]).toUTCString();
      }
      setBalance(Amount, Description, userId, cardDate);
      arrCard.length = 0;
      arrDate.length = 0;
      ctx.reply('Спасибо, запрос будет обработан.');
      return ctx.scene.leave()
    }
  )
  const getData = async (valueLogin, valuePass) => {
    let tempArr = [];
    const result = await client
      .query(`SELECT sfid,email,password__c,office__c FROM salesforce.contact WHERE email = '${valueLogin}'
      AND password__c = '${valuePass}';`)

    for (let [keys, values] of Object.entries(result.rows)) {
      for (let [key, value] of Object.entries(values)) {
        tempArr.push(value);
      }
    }
    if (!tempArr.length) {
      tempArr.length = 0;
    }
    return tempArr;
  };
  const getBalance = async (valueId) => {
    let tempArr = [];
    const result = await client
      .query(`SELECT sfid, Reminder__c, Keeper__c FROM salesforce.Monthly_Expense__c WHERE
    Keeper__c = '${valueId}';`)

    for (let [keys, values] of Object.entries(result.rows)) {
      for (let [key, value] of Object.entries(values)) {
        if (key.toUpperCase() === 'REMINDER__C') {
          tempArr.push(value);
        }
      }
    }
    if (!tempArr.length) {
      totalAmount = 0;
    }
    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    var totalAmount = tempArr.reduce(reducer);
    return totalAmount;
  };
  const setBalance = async (Amount, Description, userId, cardDate) => {
    var parsedAmount = parseFloat(Amount, 10);
    const MONTHLYFAKE = 'a012w000000VhXsAAK';
    await client
      .query(`INSERT INTO salesforce.Expense_Card__c
      (Name, Amount__c, Card_Keeper__c, Card_Date__c,Description__c, Monthly_Expense__c, ExternalID__c)
      VALUES('${userId}', ${parsedAmount}, '${userId}', '${cardDate}', '${Description}', '${MONTHLYFAKE}', gen_random_uuid());`)
  };
  client.connect();
  
  const bot = new Telegraf(API_TOKEN);
  bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
  bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
  
  const stage = new Stage([superWizard], { default: 'super-wizard' })
  bot.use(session())
  bot.use(stage.middleware())
  bot.launch()
  
  const successLogin = extra
    .markdown().markup((msg) => msg.inlineKeyboard([
      msg.callbackButton('Текущий баланс', 'balance'),
      msg.callbackButton('Создать карточку', 'createCard')
    ]));
  
  const createExpenseCard = extra
    .markdown().markup((msg) => msg.inlineKeyboard([
      msg.callbackButton('Сегодня', 'today'),
      msg.callbackButton('Календарь', 'calendar'),
      msg.callbackButton('Отмена', 'cancel')
    ]));
  
  bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
  })