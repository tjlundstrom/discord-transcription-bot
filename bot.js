/**
 * This is a Speech-To-Text-Bot meant to be used with Discord.  It is only meant to
 * interpret voice chat from a voice channel the operator or operators are in and put
 * it in text chat the operator enterred the start command in.
 * 
 * Credit:  Dogshep and Berestun initiated the base code.  Melola helped modify the
 * base code.  Bewchakka, Kalishei, Jokker, Dogshep, and Melola helped with initial
 * multi-interaction testing.  The LMA guild helped with further multi-interaction testing.
 */

// Imported modules.
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const WatsonSTT = require('watson-developer-cloud');

var config = JSON.parse(fs.readFileSync("./settings.json", "utf-8"));

const bot_controller = config.bot_controller; // Client ID from Discord bot creation site.
const discord_token = config.discord_token; // APP BOT USER Token from Discord bot creation site.
const content_type = config.content_type; // The content type field for the Watson instantiation.
const watson_username = config.watson_username; // Username from IBM Watson.
const watson_password = config.watson_password; // Password from IBM Watson.
const prefix = config.prefix; // The special character at the beginning of a word in chat that
                              // indicates the text is a command for this bot.

// These constants are the member.id's of some of the members of the specified Discord server.
// Not all members are listed.  These member id's are used to determine if a command is given
// by an authorized operator of this Bot.
const member_id_aa = config.member_id_aa;
const member_id_ab = config.member_id_ab;
const member_id_ac = config.member_id_ac;
const member_id_ad = config.member_id_ad;
const member_id_ae = config.member_id_ae;

const client = new Discord.Client();

var voiceChannel = null;
var textChannel = null;
var listenConnection = null;
var listening = false;
var recordingsPath = "";
var streamQueue = []; // Holds the queued instances of a member talking.
var streamFirstFinished = true; // Controls the individual user order flow.
var filter = true; // Profanity filter will be on by default.  This can be changed from the
                   // operator commands.



client.login(discord_token);

client.on("ready", manageIntro.bind(this));

client.on("message", manageTextMessage.bind(this));

/**
 * This function indicates in the command program that the Bot is ready to
 * operate.
 * 
 * @return void
 */
function manageIntro() {
  console.log("\n           *** This Bot is ready to play! ***\n");
  console.log("Hello authorized operator!  The commands that you can" +
              "\n   use that the bot will respond to are:\n" +
              "\n      --  !help        ->  lists the commands the bot" +
              "\n                           responds to...\n" + 
              "\n      --  !leave       ->  commands the bot to leave" +
              "\n                           the voice channel.\n" +
              "\n      --  !listen      ->  commands the bot to listen" +
              "\n                           in on the voice channel the" +
              "\n                           controller is in.\n\n" + 
              "\n              ***  HIDDEN COMMANDS  ***\n" + 
              "\n      --  !filter=on   ->  Turn on profanity filter." +
              "\n                           This is on by default.\n" + 
              "\n      --  !filter=off  ->  Turn off profanity filter.\n" + 
              "\n");
} // End of function manageIntro():void

/**
 * This function handles the text channel message to see if it is a command
 * this Bot recognizes.  If not, the Bot does nothing.  If the text is a command,
 * this Bot deals with it.
 * 
 * @param message Holds the members' text channel chat message.
 * @return void
 */
function manageTextMessage(message) {
  // Any normal message in chat will not bother the bot.
  if (!message.content.startsWith(prefix))
    return;

  // This is only used to find a user's id number if needed for operator
  // authentication.
  //console.log("\nId number of user attempting to operate this Bot is " +
  //             message.member.id + ".\n");

  // Only an authorized user, or users if added, can command the bot.  Must
  // use member.id's here, since usernames in Discord can be changed.  If it is
  // wanted to have anyone command the bot, delete this if() statement.
  if (message.member.id != member_id_aa 
      && message.member.id != member_id_ac
      && message.member.id != member_id_ad 
      && message.member.id != member_id_ae
      //&& message.member.id != member_id_ab // Member ab's id is not known yet...
                                             // This commented out line has to be last
                                             // or the code freezes.  Once the id is
                                             // known, it can be uncommented and place
                                             // back in order.
     ) {
    message.reply(" the command has to come from the operator of the bot.  Thank you.");
    return;
  }
  
  var command = message.content.toLowerCase().slice(1);

  switch (command) {
    case 'help':
      message.reply(" hello!  The commands that you can\n" +
                    "     use that the bot will respond to are:\n\n" +
                    "         --  !help                  ->  lists the commands the bot\n" +
                    "                                                  responds to...\n\n" + 
                    "         --  !help-console  ->  lists the commands the bot\n" + 
                    "                                                  responds to in the console.\n\n" + 
                    "         --  !leave                ->  commands the bot to leave\n" +
                    "                                                  the voice channel.\n\n" +
                    "         --  !listen                ->  commands the bot to listen\n" +
                    "                                                  in on the voice channel the\n" +
                    "                                                  operator is in.");
      break;

    case 'help-console':
      console.log("Hello authorized operator!  The commands that you can" +
                  "\n   use that the bot will respond to are:\n" +
                  "\n      --  !help        ->  lists the commands the bot" +
                  "\n                           responds to...\n" + 
                  "\n      --  !leave       ->  commands the bot to leave" +
                  "\n                           the voice channel.\n" +
                  "\n      --  !listen      ->  commands the bot to listen" +
                  "\n                           in on the voice channel the" +
                  "\n                           controller is in.\n\n" + 
                  "\n              ***  HIDDEN COMMANDS  ***\n" + 
                  "\n      --  !filter=on   ->  Turn on profanity filter." +
                  "\n                           This is on by default.\n" + 
                  "\n      --  !filter=off  ->  Turn off profanity filter.\n" + 
                  "\n");
      break;
      
    case 'leave':
      if (!listening) {
        message.reply(" the bot has to be present to be able to leave.");
        break;
      }

      leaveVoiceChannel();
      break;

    case 'filter=off':
      if (!filter) {
        console.log("The profanity filter is already off");
        break;
      }

      console.log("The profanity filter is now off");
      filter = false;
      break;

    case 'filter=on':
      if (filter) {
        console.log("The profanity filter is already on");
        break;
      }

      console.log("The profanity filter is now off");
      filter = true;
      break;

    case 'listen':
      textChannel = message.channel;
      listenToVoiceChannel(message);
      break;

    default:
      message.reply(" your command is not recognized!  Type '!help' for a list of commands.");
  }
} // End of the function manageTextMessage(any):void.

/**
 * This function controls the Bot's enterance to the voice channel that the operator is
 * in.  It also sets the directory to use for the text files that will be created.  This
 * function eventually passes off further Bot operated to the streamToWatson(any):void
 * function.
 * 
 * @param message Holds the members' text channel chat message.  At this point, the message
 *                is a command from an authorized operator.
 * @return void
 */
function listenToVoiceChannel(message) {
  let member = message.member; // This member variable becomes the sender of the message.
  
  if (!member)
    return;

  // The operator is not in a voice channel.
  if (!member.voiceChannel) {
    message.reply(" you need to be in a voice channel first.")
    return;
  }

  // The Bot is already in a voice channel.
  if (listening) {
    message.reply(" a voice channel is already being listened to!");
    return;
  }

  listening = true; // The bot is listening in a voice channel.
  voiceChannel = member.voiceChannel; // This variable becomes the voice channel the bot
                                      // operator is in.

  textChannel.send('Listening in on the **' + member.voiceChannel.name + '**!');

  recordingsPath = path.join('.', 'recordings');
  createFolder(recordingsPath);
  
  // The bot joins the voice channel the operator is in.
  voiceChannel.join().then((connection) => {
    listenConnection = connection;

    // Bot intro...  Warcraft II peasant "Hello".
    listenConnection.playFile('./extra_waves/000-Peasant-Hello.mp3')
      // After the intro has played...
      .on('end', (err) => {
        streamToWatson(connection, member.id);
      })
      .on('error', (err) => {
        console.log("An error has occurred between lines 230 and 237...  " + err);
      });
  });
} // End of the function listenToVoiceChannel(any):void.

/**
 * This function takes care of disconnecting from the Connection and the VoiceChannel,
 * as well as the controlling boolean, that this Bot uses.
 * 
 * @return void
 */
function leaveVoiceChannel() {
  listening = false;

  if(listenConnection) {
    // Bot farewell...  Warcraft II peasant "Work Done".
    listenConnection.playFile('./extra_waves/000-Peasant-Work-Done.mp3')
    // After the farewell has played...
    .on('end', (err) => {
      if (voiceChannel) {
        textChannel.send("Stopped listening!")
        // After the message is sent to the text channel...
        .then(() => {
          streamQueue = []; // Resets this array to empty.

          voiceChannel.leave();
          voiceChannel = null;

          listenConnection.disconnect();
          listenConnection = null;
        });
      }
    })
    .on('error', (err) => {
      console.log("An error has occurred between lines 252 and 271...  " + err);
    });
  }
} // End of the function leaveVoiceChannel():void.

/**
 * This function creates a folder/directory, unless it already exists, that the
 * text files created will be saved in.
 * 
 * @param folderToCreate The path/folder the text files created will be saved in.
 * @return void
 */
function createFolder(folderToCreate) {
  try {
    fs.mkdirSync(folderToCreate);
  } catch (err) {} // If directory is already there, an error will not display.
} // End of the function createFolder(any):void.

/**
 * This function handles the member's voice data by streaming the voice directly
 * into the Watson Speech-To-Text AI to produce a text file with the interpretation
 * of what was said by a member.  Then the text file is fed into the Discord text
 * channel.
 * 
 * @param usedConnection The Connection passed by the calling function that is used
 *                       to handle the Bot's actions in the voice channel.
 * @return void
 */
function streamToWatson(usedConnection, userTest) {
  let receiver = usedConnection.createReceiver();
  
  // This code only runs when the member is speaking.
  usedConnection.on('speaking', (member, speaking) => {
    if (speaking) {
      // Creates an instance of the Watson AI.
      var speechToText = new WatsonSTT.SpeechToTextV1 ({
        username: watson_username,
        password: watson_password,
        url: 'https://stream.watsonplatform.net/speech-to-text/api'
      });

      // Queues up the individual initiations of conversation.
      streamQueue.push(() => {
        // Returns a Promise that resolves once the internal code is finished.
        return new Promise((resolve, reject) => {
          // The path and name of the text file created.
          let capturedDataTextFilePath = 
            path.join(recordingsPath, `${member.id}-${Date.now()}-Discord.txt`);

          // Text file.
          let capturedDataTextFile = fs.createWriteStream(capturedDataTextFilePath);
          // Watson voice recognition interpretter stream.
          let sTTRecStream = speechToText.createRecognizeStream({content_type: content_type,
            profanity_filter: filter});
          
          // Voice channel stream.
          let inputStream = receiver.createPCMStream(member);
          
          // Empty voice channel stream data into the Watson interpretter and then into
          // the text file.
          inputStream.pipe(sTTRecStream).pipe(capturedDataTextFile);
          
          // Once the Watson interpreter is empty, this closes the streams and handles
          // the text file.
          sTTRecStream.on('end', () => {
            capturedDataTextFile.close();
            sTTRecStream.end();
            
            // When this Promise resolves, the function textToChatChannel() is called.
            resolve(textToChatChannel(member, capturedDataTextFilePath));
          })
          .on('error', (err) => {
            reject(console.log("An error occurred within lines 334 and 343...  " + err));
          });
        });
      });
      
      // This while() loops keeps the order of the queued functions' execution.
      while (streamQueue.length > 0) {
        // This if() statement runs if the first function in the queue has finished.
        if (streamFirstFinished) {
          streamFirstFinished = false; // Current function is now the first and running.
          streamRunOrderPromise()
          .then(() => {
            streamFirstFinished = true; // The current function has finished running.
          })
          .catch((err) => {
            console.log("An error occurred within the lines 352 and 358...  " + err);
          });
        }
      }
    }
  });
} // End of the function streamToWatson(any):void.

/**
 * This function handles typing the text data from the voice stream to the
 * text channel.
 * 
 * @param member The memeber that is talking at the moment.
 * @param textFilePath The path of the text file that holds the transcribed
 *                     data from the voice stream to be sent to the text
 *                     channel.
 * @return Promise A promise to complete the code instead of skipping it.
 */
function textToChatChannel(member, textFilePath) {
  // Returns a Promise that will resolve once the internal code is finished.
  return new Promise((resolve, reject) => {
    // Send the text file data to the Discord text channel, if the data exists.
    fs.readFile(textFilePath, function(err, data) {
      if (err)
        reject(console.log("An error occurred at line 379...  " + err));

      else {
        // There is voice data in the text file.
        if (data && data != "") {
          console.log(" -- " + member.username + " said: " + data);
          textChannel.send(member.username + " said: " + data);
          resolve();
        }

        // The file is empty or does not exist.
        else {
          console.log("There is no data in the text file containing " + 
                      "the interpretted text.");
        }
      }
    });
  });
} // End of the function textToChatChannel(any, any):void.

/**
 * This function creates a Promise to run the function first in the queue.
 * This queue holds the streams of one individual.
 * 
 * @return Promise A promise to take care of an individual user's
 *         single instance of a speaking after their earlier instance has 
 *         finished and has finished processing.
 */
function streamRunOrderPromise() {
  return new Promise((resolve, reject) => {
    // The queue has something in it.
    if (streamQueue.length > 0) {
      // This function gets the function removed from the queue.
      let queuedFunction = streamQueue.shift();

      // Calls the function from the queue.
      queuedFunction()
      .catch((err) => {
        reject(console.log("An error occurred within the lines 417 and 420...  " + err));
      });
      
      resolve();
    }

    else
      reject (console.log("An error occurred at line 412...  The array " + 
                          "streamQueue is empty..."));
  });
} // End of the function streamRunOrderPromise():void.
 


// -- The original had 297 lines...
// -- The version before cleaning the comments/commented out code is 1509 lines...
// -- The version after cleaning the comments/commented out code is 451 lines...
// -- The version after cleaning the code is 269 lines...  Still using wit.ai...
// -- The version after using Watson and cleaning the unneeded code is 276 lines...
// -- The version after adding useful comments is 404 lines...
// -- The version after adding a farewell message and modifying the leaveVoiceChannel()
//      function is 408 lines...
// -- The version after adding a queue system is 454 lines...
// -- The version after deleting recorded userid's and usernames is 338 lines...
// -- The version after adding a queue/Promise system is 341 lines...
// -- The version after adding a loop to the queue/Promise system is 375 lines...
// -- The version after adding a profanity filter on/off command is 439 lines...
// -- The version after adding a multi-user queue/Promise system is 497 lines...
// -- The version after removing the multi-user queue/Promise system is 429 lines...


/**
 *  Below this mark is all experimental code...  This statement and below can
 *  be deleted when the bot coding is finished.
 */