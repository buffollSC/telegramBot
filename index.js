const myToken = '995308759:AAG0cSOOdlAP8r3n6tnaXtBx0wArse89YDA';
const port = "5010";
const dataBase = "postgres://lfodygkpkxwiut:97c34dfaa384d8fae43c0ad8db1e3acec41a5ba9eb618eb74557116f2e5b8dbf@ec2-54-228-246-214.eu-west-1.compute.amazonaws.com:5432/ddf4globq3eaio";
const applicationURL = 'https://heroku-telegram-bots.herokuapp.com:443';

const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');
const extra = require('telegraf/extra');

const { Client } = require('pg');

const arrCreatCard = [];
const arrDate = [];
const arrLoginAndPassword = [];

const API_TOKEN = process.env.TOKEN || myToken;
const PORT = process.env.PORT || port;
const URL = process.env.APP_URL || applicationURL;

//-----------------------------------------------------------------
const successLogin = extra.markdown().markup((msg) => msg.inlineKeyboard([
  msg.callbackButton('Текущий баланс', 'balance'),
  msg.callbackButton('Создать карточку', 'createCard'),
  msg.callbackButton('Выход', 'logout')
]));
const createExpenseCard = extra.markdown().markup((msg) => msg.inlineKeyboard([
  msg.callbackButton('Сегодня', 'today'),
  msg.callbackButton('Календарь', 'calendar'),
  msg.callbackButton('Отмена', 'cancel')
]))
//------------------------------------------------------------------
let client = new Client({
    connectionString: process.env.DATABASE_URL || dataBase,
    ssl: true
});

const stepHandler = new Composer();
stepHandler.action('balance', async (ctx) => {
  let userId = ctx.scene.session.state.allInformation[0];
  const allInformationId = await getBalance(userId);
  ctx.reply(`Текущий баланс: ${allInformationId}$`, successLogin);
  return 0;
})
stepHandler.action('logout', async (ctx) => {
  ctx.reply('Для авторизации нажмите любую кнопку');
  return ctx.scene.leave();
})
stepHandler.action('createCard', (ctx) => {
  ctx.reply(`На какой день хотите создать карту?`, createExpenseCard)
  return ctx.wizard.next()
})
stepHandler.use((ctx) => ctx.replyWithMarkdown('Авторизация прошла успешно', successLogin));

const getDataForAuthorization = async(valueLogin, valuePassword) => {
  let arrReturn = [];
  const allInformation = await client
    .query(`SELECT sfid, email, password__c, office__c 
    FROM salesforce.contact 
    WHERE email = '${valueLogin}'
    AND password__c = '${valuePassword}';`)

  for (let [keys, values] of Object.entries(allInformation.rows)) {
    for (let [key, value] of Object.entries(values)) {
      arrReturn.push(value);
    }
  }
  if (!arrReturn.length) {
    arrReturn.length = 0;
  }
  return arrReturn;
};
const getBalance = async (valueId) => {
  let arrQuery = [];
  totalAmount = 0;
  const allInformation = await client
  .query(`SELECT sfid, Reminder__c, Keeper__c 
  FROM salesforce.Monthly_Expense__c 
  WHERE Keeper__c = '${valueId}';`)
  for (let [keys, values] of Object.entries(allInformation.rows)) {
    for (let [key, value] of Object.entries(values)) {
      if (key.toUpperCase() === 'REMINDER__C') {
        arrQuery.push(value);
      }
    }
  }
  const totalAmountValue = (current, currentValue) => current + currentValue;
  var totalAmount = arrQuery.reduce(totalAmountValue);
  return totalAmount;
};

const setBalance = async (Amount, Description, userId, cardDate) => {
  var parsedAmount = parseFloat(Amount, 10);
  await client
  .query(`INSERT INTO salesforce.Expense_Card__c(Name, Amount__c, Card_Keeper__c, Card_Date__c, Description__c, ExterId__c)
  VALUES('${userId}', ${parsedAmount}, '${userId}', '${cardDate}', '${Description}', gen_random_uuid());`)
};

const superWizard = new WizardScene('super-wizard',
  (ctx) => {
    ctx.scene.session.state = {}
    ctx.reply('Для авторизации введите логин или email: ');
    return ctx.wizard.next()
  },
  (ctx) => {
    ctx.reply('Введите пароль: ');
    arrLoginAndPassword.push(ctx.message.text);
    return ctx.wizard.next();
  },
  async (ctx) => {
    arrLoginAndPassword.push(ctx.message.text);
    Login = arrLoginAndPassword[0];
    Password = arrLoginAndPassword[1];
    const allInformation = await getDataForAuthorization(Login, Password)
    arrLoginAndPassword.length = 0;
    if (allInformation.length === 4) {
      ctx.scene.session.state = {
        allInformation : allInformation
      }
      ctx.reply('Авторизация прошла успешно', successLogin);
      return ctx.wizard.next();
    }else if(allInformation.length === 0) {
      ctx.reply('Неправильный логин и/или пароль,напишете что-нибудь для повторной авторизации');
      return ctx.scene.leave();
    }
  },

  stepHandler,
  (ctx) => {
    let callbackData = ctx.update.callback_query.data;
    ctx.scene.session.state.allInformation.push(callbackData);

    if(callbackData.toUpperCase() === 'CANCEL') {
      ctx.reply('Главное меню', successLogin);
      return ctx.wizard.back();
    }
    else if(callbackData.toUpperCase() === 'TODAY') {
      ctx.reply('Введите сумму в поле Amount?');
      return ctx.wizard.selectStep(6);
    }
    else if(callbackData.toUpperCase() === 'CALENDAR') {
      ctx.reply('Запишите дату в формате YYYY-MM-DD');
      return ctx.wizard.next();
    }
  }, 
  (ctx) => {
    arrDate.push(ctx.message.text);
    ctx.reply('Введите сумму в поле Amount?');
    return ctx.wizard.next();
  }, 
  (ctx) => {
    arrCreatCard.push(ctx.message.text);
    ctx.reply('Напишите описание в поле Description?');
    return ctx.wizard.next();
  }, 
  (ctx) => {
    arrCreatCard.push(ctx.message.text)
    
    let Amount = arrCreatCard[0];
    let Description = arrCreatCard[1];
    let userId = ctx.scene.session.state.allInformation[0];
    let cardDate = new Date().toUTCString();
  
    if (arrDate.length != 0) {
      cardDate = new Date(arrDate[0]).toUTCString();
    }

    setBalance(Amount, Description, userId, cardDate);
    arrCreatCard.length = 0;
    arrDate.length = 0;
    ctx.reply('Запрос обработан.', successLogin);
    return ctx.wizard.selectStep(3);
    }
  )

 
  client.connect();
  const bot = new Telegraf(API_TOKEN);
  bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
  bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
  
  const stage = new Stage([superWizard], { default: 'super-wizard' });
  bot.use(session());
  bot.use(stage.middleware());
  bot.launch();

  bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
  })