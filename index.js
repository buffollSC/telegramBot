const myToken = '995308759:AAG0cSOOdlAP8r3n6tnaXtBx0wArse89YDA';
const port = "5010";
const dataBase = "postgres://lfodygkpkxwiut:97c34dfaa384d8fae43c0ad8db1e3acec41a5ba9eb618eb74557116f2e5b8dbf@ec2-54-228-246-214.eu-west-1.compute.amazonaws.com:5432/ddf4globq3eaio";
const applicationURL = 'https://heroku-telegram-bots.herokuapp.com:443';
const Telegraf = require('telegraf');
const telegrafComposer = require('telegraf/composer');
const session = require('telegraf/session');
const telegrafStage = require('telegraf/stage');
const markup = require('telegraf/markup');
const telegrafScenesWizard = require('telegraf/scenes/wizard');
const extra = require('telegraf/extra');
const { Client } = require('pg');
const API_TOKEN = process.env.TOKEN || myToken;
const PORT = process.env.PORT || port;
const URL = process.env.APP_URL || applicationURL;
const arrInfaForExpCard = [];
const arrDateForExpCard = [];
const arrLoginAndPassword = [];

//------------------------Menu-----------------------------------------
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
//---------------------Connection to database---------------------------
let client = new Client({
    connectionString: process.env.DATABASE_URL || dataBase,
    ssl: true
});
//---------------------Steps for user-----------------------------------
const stepForUser = new telegrafComposer();
stepForUser.action('balance', async (ctx) => {
  let userId = ctx.scene.session.state.allInformation[0];
  const allInformationId = await getBalance(userId);
  ctx.reply(`Текущий баланс: ${allInformationId}$`, successLogin);
  return 0;
})
stepForUser.action('logout', async (ctx) => {
  ctx.reply('Для авторизации нажмите любую кнопку');
  return ctx.scene.leave();
})
stepForUser.action('createCard', (ctx) => {
  ctx.reply(`На какой день хотите создать карту?`, createExpenseCard)
  return ctx.wizard.next()
})
//-------------------Method for get Login and Password--------------
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
//-----------------Method for get Balance--------------------------
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
//-----------------Method for set Expense card -------------------------
const setExpenseCard = async (Amount, Description, userId, cardDate) => {
  var parsedAmount = parseFloat(Amount, 10);
  await client
  .query(`INSERT INTO salesforce.Expense_Card__c(Name, Amount__c, Card_Keeper__c, Card_Date__c, Description__c, ExterId__c)
  VALUES('${userId}', ${parsedAmount}, '${userId}', '${cardDate}', '${Description}', gen_random_uuid());`)
};

//stepForUser.use((ctx) => ctx.replyWithMarkdown('Авторизация прошла успешно', successMsg))

//-----------------------Authorization----------------------------------
const authorizationUser = new telegrafScenesWizard('authorization-User',
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
//----------------Steps after clicked on button "Создать карточку"-------
  stepForUser,
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
    arrDateForExpCard.push(ctx.message.text);
    ctx.reply('Введите сумму в поле Amount?');
    return ctx.wizard.next();
  }, 
  (ctx) => {
    arrInfaForExpCard.push(ctx.message.text);
    ctx.reply('Напишите описание в поле Description?');
    return ctx.wizard.next();
  }, 
  //-------------Record in salesforce database-------------------
  (ctx) => {
    arrInfaForExpCard.push(ctx.message.text)

    let Amount = arrInfaForExpCard[0];
    let Description = arrInfaForExpCard[1];
    let userId = ctx.scene.session.state.allInformation[0];
    let cardDate = new Date().toUTCString();
  
    if (arrDateForExpCard.length != 0) {
      cardDate = new Date(arrDateForExpCard[0]).toUTCString();
    }

    setExpenseCard(Amount, Description, userId, cardDate);
    arrInfaForExpCard.length = 0;
    arrDateForExpCard.length = 0;
    ctx.reply('Запрос обработан.', successLogin);
    return ctx.wizard.selectStep(3);
    }
  )
  client.connect();
//-----------Creat bot-----------------------------------------
 const bot = new Telegraf(myToken);
 bot.telegram.setWebhook(`${applicationURL}/bot${myToken}`);
 bot.startWebhook(`/bot${myToken}`, null, port);

 const stage = new telegrafStage([authorizationUser], { default: 'authorization-User' });
 bot.use(session());
 bot.use(stage.middleware());
 bot.launch();
 //---------------------Handler errors----------------------------
 bot.catch((err, ctx) => {
  console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
 })