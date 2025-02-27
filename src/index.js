const shuffle = require('shuffle-array');

const games = new Set();
const Discord = require('discord.js');
const Collect = require('./collect');

/** 
    * @param {Discord.Message || Discord.CommandInteraction} message The Message Object or the Interaction Object sent by the user
    * @param {object} options The options object (optional)
    * @returns Promise<Object>
    * @async
    * @example
    * const blackjack = require("discord-blackjack")
    * // other code here
    *
    * // if you are using prefix commands
    * client.on("messageCreate", async message => {
    *     if (message.content === "!blackjack") {
    *         blackjack(message)        
    *     }
    * })

    * // if you are using slash commands
    * client.on("interactionCreate", async interaction => {
    *     if (!interaction.isCommand) return;
    *     
    *     if (interaction.commandName === "blackjack") {
    *         blackjack(interaction)
    *     }
    * })
    * 
    * // other code here
*/

module.exports = async (message, options) => {
  // check if all the variables given are valid
  if (!message) throw new Error('[MISSING_PARAMETER] The message or interaction parameter was not provided, was null or undefined.');

  // check if message and commandInteraction aren't something made up
  if (!message.isChatInputCommand() && !message instanceof Discord.Message)
    throw new Error('[INVALID_PARAMATER] The message or interaction parameter provided is not valid.');

  // set all the options
  if (!options) options = {}; // if options were not provided, make an empty object
  options.transition === 'edit' ? (options.transition = 'edit') : (options.transition = 'delete'); // how they want the embeds to be transitioned
  options.buttons === false ? (options.buttons = false) : (options.buttons = true); // check if buttons were enabled
  options.doubledown === false ? (options.doubledown = false) : (options.doubledown = true); // check if double down should appear
  options.insurance === false ? (options.insurance = false) : (options.insurance = true); // check if double down should appear
  options.split === false ? (options.split = false) : (options.split = true); // check if split should appear
  options.resultEmbed === false ? (options.resultEmbed = false) : (options.resultEmbed = true); // check if the result embed should be displayed
  options.normalEmbed === false ? (options.normalEmbed = false) : (options.normalEmbed = true); // check if they want the default embed when playing
  !options.emojis ? (options.emojis = {}) : options.emojis;
  options.betAmt = options.betAmt;

  options.emojis = {
    clubs: options.emojis?.clubs || '♣️',
    spades: options.emojis?.spades || '♠️',
    hearts: options.emojis?.hearts || '♥️',
    diamonds: options.emojis?.diamonds || '♦️'
  };

  // set what type the message is
  let commandType;
  if (message instanceof Discord.Message) {
    commandType = 'message';
  } else if (message.isChatInputCommand()) {
    commandType = 'interaction';
  }

  options.commandType = commandType;

  // check if options is an object
  if (options && !(options instanceof Object))
    throw new Error(
      `[INVALID_PARAMATER] The options parameter expected an object, but recieved ${Array.isArray(options) ? 'array' : typeof options}`
    );

  // check if the emojis option is an object
  if (typeof options.emojis !== 'object')
    throw new Error(`[INVALID_PARAMATER] The options.emojis parameter expected an object, but recieved ${typeof options}.`);

  // check if the properties for the options.emojis object are strings.
  if (typeof options.emojis.spades !== 'string')
    throw new Error(`[INVALID_PARAMATER] The emojis.spades option expected a string, but recieved ${typeof options.emojis.spades}`);
  if (typeof options.emojis.hearts !== 'string')
    throw new Error(`[INVALID_PARAMATER] The emojis.hearts option expected a string, but recieved ${typeof options.emojis.hearts}`);
  if (typeof options.emojis.diamonds !== 'string')
    throw new Error(`[INVALID_PARAMATER] The emojis.diamonds option expected a string, but recieved ${typeof options.emojis.diamonds}`);
  if (typeof options.emojis.clubs !== 'string')
    throw new Error(`[INVALID_PARAMATER] The emojis.clubs option expected a string, but recieved ${typeof options.emojis.clubs}`);

  // check if the normalEmbed option was set to false but normalEmbedContent was not provided
  if (options.normalEmbed === false && !options.normalEmbedContent)
    throw new Error('[MISSING_PARAMETER] The normalEmbedContent option was not provided, was null or undefined when normalEmbed was set to false.');

  // check if the normalEmbed option was set to false but normalEmbedContent is not a MessageEmbed
  if (options.normalEmbed === false && typeof options.normalEmbedContent !== 'object')
    throw new Error('[INVALID_PARAMATER] The normalEmbedContent parameter provided is not valid.');

  let starterMessage;

  // defer the reply if the commandType is interaction and if the reply has not been deffered
  if (commandType === 'interaction' && !message.deferred && !message.replied) {
    starterMessage = await message.deferReply();
  } else if (commandType === 'message') {
    starterMessage = await message.channel.send({ embeds: [{ title: 'Game is starting.', description: 'The game is starting soon, get ready!' }] });
  }

  // check if the user is playing a game
  if (games.has(message.member.id)) {
    if (commandType === 'message') {
      message.reply('You are already playing a game!');
    } else if (commandType === 'interaction') {
      if (message.replied || message.deferred) {
        message.followUp({ content: 'You are already playing a game!' });
      } else {
        message.reply({ content: 'You are already playing a game!' });
      }
    }
    return {
      result: 'None',
      method: 'None',
      ycard: 'None',
      dcard: 'None'
    };
  }

  // set all the variables
  const normalEmbedContent = options.normalEmbedContent ?? 'None';
  const { transition } = options;
  const { buttons } = options;
  const { doubledown } = options;
  const { insurance } = options;
  const { split } = options;
  const { resultEmbed } = options;
  const { normalEmbed } = options;
  const userId = message.member.id;
  let isSoft = false;
  const method = 'None';
  const copiedEmbed = {
    content: '',
    value: ''
  };

  // set the decks
  const DECK = [
    { suit: 'clubs', rank: 'A', value: [1, 11], emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '2', value: 2, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '3', value: 3, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '4', value: 4, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '5', value: 5, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '6', value: 6, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '7', value: 7, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '8', value: 8, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '9', value: 9, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: '10', value: 10, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: 'J', value: 10, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: 'Q', value: 10, emoji: options.emojis.clubs },
    { suit: 'clubs', rank: 'K', value: 10, emoji: options.emojis.clubs },

    { suit: 'diamonds', rank: 'A', value: [1, 11], emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '2', value: 2, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '3', value: 3, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '4', value: 4, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '5', value: 5, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '6', value: 6, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '7', value: 7, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '8', value: 8, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '9', value: 9, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: '10', value: 10, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: 'J', value: 10, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: 'Q', value: 10, emoji: options.emojis.diamonds },
    { suit: 'diamonds', rank: 'K', value: 10, emoji: options.emojis.diamonds },

    { suit: 'hearts', rank: 'A', value: [1, 11], emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '2', value: 2, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '3', value: 3, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '4', value: 4, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '5', value: 5, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '6', value: 6, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '7', value: 7, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '8', value: 8, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '9', value: 9, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: '10', value: 10, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: 'J', value: 10, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: 'Q', value: 10, emoji: options.emojis.hearts },
    { suit: 'hearts', rank: 'K', value: 10, emoji: options.emojis.hearts },

    { suit: 'spades', rank: 'A', value: [1, 11], emoji: options.emojis.spades },
    { suit: 'spades', rank: '2', value: 2, emoji: options.emojis.spades },
    { suit: 'spades', rank: '3', value: 3, emoji: options.emojis.spades },
    { suit: 'spades', rank: '4', value: 4, emoji: options.emojis.spades },
    { suit: 'spades', rank: '5', value: 5, emoji: options.emojis.spades },
    { suit: 'spades', rank: '6', value: 6, emoji: options.emojis.spades },
    { suit: 'spades', rank: '7', value: 7, emoji: options.emojis.spades },
    { suit: 'spades', rank: '8', value: 8, emoji: options.emojis.spades },
    { suit: 'spades', rank: '9', value: 9, emoji: options.emojis.spades },
    { suit: 'spades', rank: '10', value: 10, emoji: options.emojis.spades },
    { suit: 'spades', rank: 'J', value: 10, emoji: options.emojis.spades },
    { suit: 'spades', rank: 'Q', value: 10, emoji: options.emojis.spades },
    { suit: 'spades', rank: 'K', value: 10, emoji: options.emojis.spades }
  ];

  const hitbtn = { label: 'Hit', style: 1, custom_id: 'discord-blackjack-hitbtn', type: 2 };
  const standbtn = { label: 'Stand', style: 1, custom_id: 'discord-blackjack-standbtn', type: 2 };
  const ddownbtn = { label: 'Double Down', style: 1, custom_id: 'discord-blackjack-ddownbtn', type: 2 };
  const splitbtn = { label: 'Split', style: 1, custom_id: 'discord-blackjack-splitbtn', type: 2 };
  const insbtn = { label: 'Insurance', style: 1, custom_id: 'discord-blackjack-insbtn', type: 2 };
  const noinsbtn = { label: 'No Insurance', style: 4, custom_id: 'discord-blackjack-noinsbtn', type: 2 };
  const cancelbtn = { label: 'Cancel', style: 4, custom_id: 'discord-blackjack-cancelbtn', type: 2 };

  const row1 = { type: 1, components: [hitbtn, standbtn] };
  const row2 = { type: 1, components: [cancelbtn] };

  shuffle(DECK);
  shuffle(DECK);
  shuffle(DECK);
  shuffle(DECK);
  shuffle(DECK);

  const currentDeck = DECK;
  const testDeck = [
    { suit: 'spades', rank: '5', value: 5, emoji: options.emojis.spades },
    { suit: 'spades', rank: '5', value: 5, emoji: options.emojis.spades }
  ];
  const testDeck2 = [
    { suit: 'spades', rank: 'A', value: [1, 11], emoji: options.emojis.spades },
    { suit: 'spades', rank: '10', value: 10, emoji: options.emojis.spades }
  ];
  // shuffle(testDeck)
  // shuffle(testDeck2)
  const yourcards = [currentDeck.pop(), currentDeck.pop()];
  // let yourcards = [testDeck[0],testDeck[1]]

  const dealercards = [currentDeck.pop(), currentDeck.pop()];
  // let dealercards = [testDeck2[0],testDeck2[1]]

  // set the embeds
  const winEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const loseEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const tieEmbed = {
    title: 'Blackjack',
    color: 0xffff00,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitWinEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitLoseEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitTieEmbed = {
    title: 'Blackjack',
    color: 0xffff00,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitTieWinEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitWinTieEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitTieLoseEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitLoseTieEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitWinLoseEmbed = {
    title: 'Blackjack',
    color: 0xffff00,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const splitLoseWinEmbed = {
    title: 'Blackjack',
    color: 0xffff00,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const insWinEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const insLoseEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const insTieEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const insPayEmbed = {
    title: 'Blackjack',
    color: 0x008800,
    description: '',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
  };
  const timeoutEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: 'You took more than 30 seconds to respond. The time is up and the game has canceled.',
    fields: [],
    author: { name: message.member.user.tag, icon_url: message.member.displayAvatarURL() }
  };
  const cancelEmbed = {
    title: 'Blackjack',
    color: 0xff0000,
    description: 'You decided to cancel your ongoing blackjack game.',
    fields: [],
    author: { name: message.member.displayName, icon_url: message.member.displayAvatarURL() }
  };
  const generalEmbed =
    normalEmbed === false
      ? options.normalEmbedContent
      : {
          title: 'Blackjack',
          color: Math.floor(Math.random() * (0xffffff + 1)),
          fields: [
            { name: 'Your hand', value: '', inline: true },
            { name: 'Dealer\'s hand', value: '', inline: true }
          ],
          author: { name: message.member.displayName, icon_url: message.member.user.displayAvatarURL() }
        };

  // set the filters
  const allFilter = ['h', 'hit', 's', 'stand', 'cancel'];

  if (yourcards[0].rank === yourcards[1].rank && yourcards[0].rank === 'A') {
    yourcards[0].value = 11;
    yourcards[1].value = 1;
    isSoft = true;
  } else if (yourcards[0].rank === 'A') {
    yourcards[0].value = 11;
  } else if (yourcards[1].rank === 'A') {
    yourcards[1].value = 11;
  }

  if (dealercards[0].rank === dealercards[1].rank && dealercards[0].rank === 'A') {
    dealercards[0].value = 11;
    dealercards[1].value = 1;
    isSoft = true;
  } else if (dealercards[0].rank === 'A') {
    dealercards[0].value = 11;
  } else if (dealercards[1].rank === 'A') {
    dealercards[1].value = 11;
  }

  if (yourcards.map((c) => c.rank).includes('A')) isSoft = true;

  generalEmbed.fields[0].value = `Cards: ${yourcards.map((c) => `[\`${c.emoji} ${c.rank}\`](https://google.com)`).join(' ')}\nTotal:${
    isSoft ? ' Soft' : ''
  } ${yourcards.map((c) => c.value).reduce((a, b) => b + a)}`;
  generalEmbed.fields[1].value = `Cards: [\`${dealercards[0].emoji} ${dealercards[0].rank}\`](https://google.com) \` ? \`\nTotal: \` ? \``;

  options.embed = generalEmbed;
  const yourvalue = yourcards.map((c) => c.value).reduce((a, b) => b + a);
  const dealervalue = dealercards.map((c) => c.value).reduce((a, b) => b + a);

  // check if we can do double down
  if (doubledown === true) {
    if (
      yourcards.map((a) => a.value).reduce((a, b) => b + a) === 9 ||
      yourcards.map((a) => a.value).reduce((a, b) => b + a) === 10 ||
      yourcards.map((a) => a.value).reduce((a, b) => b + a) === 11
    ) {
      row1.components.push(ddownbtn);
      allFilter.push('d');
      allFilter.push('doubledown');
    }
  }

  // check if we can do split
  if (yourcards[0].rank === yourcards[1].rank && split === true) {
    row1.components.push(splitbtn);
    allFilter.push('split');
  }

  // check if we offer insurance
  if (dealercards[0].rank === 'A' && insurance === true) {
    if (yourvalue != 21) {
      row1.components = [];
      row1.components.push(insbtn);
      row1.components.push(noinsbtn);
      allFilter.push('i');
      allFilter.push('insurance');
      allFilter.push('ni');
      allFilter.push('noinsurance');
    }
  }

  // start the game
  if (yourvalue === 21 && dealervalue != 21) {
    if (options.resultEmbed === true) {
      winEmbed.description = `You won <:coin:706659001164628008> \`${Number(options.betAmt).toLocaleString('en')}\` with blackjack.`;
      winEmbed.fields.push({
        name: 'Your hand',
        value: `Cards: [\`${yourcards[0].emoji} ${yourcards[0].rank}\`](https://google.com) [\`${yourcards[1].emoji} ${yourcards[1].rank}\`](https://google.com)\nTotal: ${yourvalue}`,
        inline: true
      });
      winEmbed.fields.push({
        name: 'Dealer\'s hand',
        value: `Card: [\`${dealercards[0].emoji} ${dealercards[0].rank}\`](https://google.com) [\`${dealercards[1].emoji} ${dealercards[1].rank}\`](https://google.com)\nTotal: ${dealervalue}`,
        inline: true
      });
      commandType === 'message' ? message.channel.send({ embeds: [winEmbed] }) : message.editReply({ embeds: [winEmbed] });
    }

    return {
      result: 'BLACKJACK',
      method: 'You won with blackjack.',
      ycard: yourcards,
      dcard: dealercards
    };
  }

  // else if (dealervalue === 21 && yourvalue != 21) {
  //     if (options.resultEmbed === true) {
  //         loseEmbed.description = "You lost (dealer had blackjack)."
  //         loseEmbed.fields.push({ name: "Your hand", value: `Cards: [\`${yourcards[0].emoji} ${yourcards[0].rank}\`](https://google.com) [\`${yourcards[1].emoji} ${yourcards[1].rank}\`](https://google.com)\nTotal: ${yourvalue}` })
  //         loseEmbed.fields.push({ name: "Dealer's hand", value: `Cards: [\`${dealercards[0].emoji} ${dealercards[0].rank}\`](https://google.com) [\`${dealercards[1].emoji} ${dealercards[1].rank}\`](https://google.com)\nTotal: ${dealervalue}` })
  //         commandType === "message" ? message.channel.send({ embeds: [loseEmbed] }) : message.channel.send({ embeds: [loseEmbed] })
  //     }

  //     return {
  //         result: "LOSE",
  //         method: "You lost (dealer had blackjack).",
  //         ycard: yourcards,
  //         dcard: dealercards
  //     }
  // }
  if (dealervalue === 21 && dealervalue == yourvalue) {
    if (options.resultEmbed === true) {
      tieEmbed.description = 'You tied (both had blackjack).';
      tieEmbed.fields.push({
        name: 'Your hand',
        value: `Cards: [\`${yourcards[0].emoji} ${yourcards[0].rank}\`](https://google.com) [\`${yourcards[1].emoji} ${yourcards[1].rank}\`](https://google.com)\nTotal: ${yourvalue}`
      });
      tieEmbed.fields.push({
        name: 'Dealer\'s hand',
        value: `Cards: [\`${dealercards[0].emoji} ${dealercards[0].rank}\`](https://google.com) [\`${dealercards[1].emoji} ${dealercards[1].rank}\`](https://google.com)\nTotal: ${dealervalue}`
      });
      commandType === 'message' ? message.channel.send({ embeds: [tieEmbed] }) : message.editReply({ embeds: [tieEmbed] });
    }

    return {
      result: 'TIE',
      method: 'You tied (both had blackjack).',
      ycard: yourcards,
      dcard: dealercards
    };
  }

  const editReply = async (msg, reply, commandType) => {
    if (commandType === 'message') {
      return await msg.edit({ embeds: [reply], components: buttons ? [row1, row2] : [] });
    }
    return await message.editReply({ embeds: [reply], components: buttons ? [row1, row2] : [] });
  };

  const currentMessage = await editReply(starterMessage, generalEmbed, commandType);
  const finalResult = await (options.buttons
    ? new Collect().buttonCollect(currentMessage, userId, yourcards, dealercards, currentDeck, options)
    : new Collect().messageCollect(currentMessage, userId, yourcards, dealercards, currentDeck, options, allFilter));

  if (options.resultEmbed === true) {
    const resultingEmbed = {
      WIN: winEmbed,
      BLACKJACK: winEmbed,
      LOSE: loseEmbed,
      TIE: tieEmbed,
      'DOUBLE WIN': winEmbed,
      'DOUBLE LOSE': loseEmbed,
      'DOUBLE TIE': tieEmbed,
      'SPLIT WIN-LOSE': splitWinLoseEmbed,
      'SPLIT LOSE-WIN': splitLoseWinEmbed,
      'SPLIT TIE-TIE': splitTieEmbed,
      'SPLIT WIN-WIN': splitWinEmbed,
      'SPLIT LOSE-LOSE': splitLoseEmbed,
      'SPLIT TIE-WIN': splitTieWinEmbed,
      'SPLIT WIN-TIE': splitWinTieEmbed,
      'SPLIT TIE-LOSE': splitTieLoseEmbed,
      'SPLIT LOSE-TIE': splitLoseTieEmbed,
      'SPLIT BLACKJACK-WIN': splitWinEmbed,
      'SPLIT WIN-BLACKJACK': splitWinEmbed,
      'SPLIT BLACKJACK-LOSE': splitWinLoseEmbed,
      'SPLIT LOSE-BLACKJACK': splitLoseWinEmbed,
      'SPLIT BLACKJACK-BLACKJACK': splitWinEmbed,
      'SPLIT BLACKJACK-TIE': splitWinTieEmbed,
      'SPLIT TIE-BLACKJACK': splitTieWinEmbed,
      'SPLIT DOUBLE WIN-LOSE': splitWinLoseEmbed,
      'SPLIT DOUBLE LOSE-WIN': splitLoseWinEmbed,
      'SPLIT DOUBLE TIE-TIE': splitTieEmbed,
      'SPLIT DOUBLE WIN-WIN': splitWinEmbed,
      'SPLIT DOUBLE LOSE-LOSE': splitLoseEmbed,
      'SPLIT DOUBLE TIE-WIN': splitTieWinEmbed,
      'SPLIT DOUBLE WIN-TIE': splitWinTieEmbed,
      'SPLIT DOUBLE TIE-LOSE': splitTieLoseEmbed,
      'SPLIT DOUBLE LOSE-TIE': splitLoseTieEmbed,
      'SPLIT DOUBLE BLACKJACK-WIN': splitWinEmbed,
      'SPLIT DOUBLE WIN-BLACKJACK': splitWinEmbed,
      'SPLIT DOUBLE BLACKJACK-LOSE': splitWinLoseEmbed,
      'SPLIT DOUBLE LOSE-BLACKJACK': splitLoseWinEmbed,
      'SPLIT DOUBLE BLACKJACK-BLACKJACK': splitWinEmbed,
      'SPLIT DOUBLE BLACKJACK-TIE': splitWinTieEmbed,
      'SPLIT DOUBLE TIE-BLACKJACK': splitTieWinEmbed,
      'SPLIT WIN-DOUBLE LOSE': splitWinLoseEmbed,
      'SPLIT LOSE-DOUBLE WIN': splitLoseWinEmbed,
      'SPLIT TIE-DOUBLE TIE': splitTieEmbed,
      'SPLIT WIN-DOUBLE WIN': splitWinEmbed,
      'SPLIT LOSE-DOUBLE LOSE': splitLoseEmbed,
      'SPLIT TIE-DOUBLE WIN': splitTieWinEmbed,
      'SPLIT WIN-DOUBLE TIE': splitWinTieEmbed,
      'SPLIT TIE-DOUBLE LOSE': splitTieLoseEmbed,
      'SPLIT LOSE-DOUBLE TIE': splitLoseTieEmbed,
      'SPLIT BLACKJACK-DOUBLE WIN': splitWinEmbed,
      'SPLIT WIN-DOUBLE BLACKJACK': splitWinEmbed,
      'SPLIT BLACKJACK-DOUBLE LOSE': splitWinLoseEmbed,
      'SPLIT LOSE-DOUBLE BLACKJACK': splitLoseWinEmbed,
      'SPLIT BLACKJACK-DOUBLE BLACKJACK': splitWinEmbed,
      'SPLIT BLACKJACK-DOUBLE TIE': splitWinTieEmbed,
      'SPLIT TIE-DOUBLE BLACKJACK': splitTieWinEmbed,
      'SPLIT DOUBLE WIN-DOUBLE LOSE': splitWinLoseEmbed,
      'SPLIT DOUBLE LOSE-DOUBLE WIN': splitLoseWinEmbed,
      'SPLIT DOUBLE TIE-DOUBLE TIE': splitTieEmbed,
      'SPLIT DOUBLE WIN-DOUBLE WIN': splitWinEmbed,
      'SPLIT DOUBLE LOSE-DOUBLE LOSE': splitLoseEmbed,
      'SPLIT DOUBLE TIE-DOUBLE WIN': splitTieWinEmbed,
      'SPLIT DOUBLE WIN-DOUBLE TIE': splitWinTieEmbed,
      'SPLIT DOUBLE TIE-DOUBLE LOSE': splitTieLoseEmbed,
      'SPLIT DOUBLE LOSE-DOUBLE TIE': splitLoseTieEmbed,
      'SPLIT DOUBLE BLACKJACK-DOUBLE WIN': splitWinEmbed,
      'SPLIT DOUBLE WIN-DOUBLE BLACKJACK': splitWinEmbed,
      'SPLIT DOUBLE BLACKJACK-DOUBLE LOSE': splitWinLoseEmbed,
      'SPLIT DOUBLE LOSE-DOUBLE BLACKJACK': splitLoseWinEmbed,
      'SPLIT DOUBLE BLACKJACK-DOUBLE BLACKJACK': splitWinEmbed,
      'SPLIT DOUBLE BLACKJACK-DOUBLE TIE': splitWinTieEmbed,
      'SPLIT DOUBLE TIE-DOUBLE BLACKJACK': splitTieWinEmbed,
      'INSURANCE PAYOUT': insPayEmbed,
      'INSURANCE WIN': insWinEmbed,
      'INSURANCE LOSE': insLoseEmbed,
      'INSURANCE TIE': insTieEmbed,
      CANCEL: cancelEmbed,
      TIMEOUT: timeoutEmbed
    };

    const finalEmbed = resultingEmbed[finalResult.result];
    if (finalResult.method !== 'None') {
      finalEmbed.description = finalResult.method;
    }
    finalEmbed.fields.push({
      name: 'Your hand',
      value: `Cards: ${finalResult.ycard.map((c) => `[\`${c.emoji} ${c.rank}\`](https://google.com)`).join(' ')}\nTotal: ${finalResult.ycard
        .map((card) => card.value)
        .reduce((a, b) => b + a)}`,
      inline: true
    });
    if (finalResult.ycard2 != null) {
      finalEmbed.fields.push({
        name: 'Your 2nd hand',
        value: `Cards: ${finalResult.ycard2.map((c) => `[\`${c.emoji} ${c.rank}\`](https://google.com)`).join(' ')}\nTotal: ${finalResult.ycard2
          .map((card) => card.value)
          .reduce((a, b) => b + a)}`,
        inline: true
      });
    }
    finalEmbed.fields.push({
      name: `${message.client.user.username}'s hand`,
      value: `Cards: ${finalResult.dcard.map((c) => `[\`${c.emoji} ${c.rank}\`](https://google.com)`).join(' ')}\nTotal: ${finalResult.dcard
        .map((card) => card.value)
        .reduce((a, b) => b + a)}`,
      inline: true
    });
    options.commandType === 'message' ? message.channel.send({ embeds: [finalEmbed] }) : message.editReply({ embeds: [finalEmbed] });
  }
  return finalResult;
};
