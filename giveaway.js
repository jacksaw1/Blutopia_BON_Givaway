// ==UserScript==
// @namespace    https://openuserjs.org/users/jacksaw
// @name         Blutopia BON Giveaway
// @description  Enables the functionality to become poor
// @version      1.7.0
// @updateURL    https://openuserjs.org/meta/jacksaw/Blutopia_BON_Giveaway.meta.js
// @downloadURL  https://openuserjs.org/install/jacksaw/Blutopia_BON_Giveaway.user.js
// @license      GPL-3.0-or-later
// @match        https://blutopia.cc/
// @match        https://aither.cc/
// @grant        none
// ==/UserScript==

// ==OpenUserJS==
// @author jacksaw
// @collaborator Coasty
// ==/OpenUserJS==

// Additional credits
// @TheEther - Integration with Aither + some additional features

// Ideas
//Split entries table on scroll? Maybe just use tabulation for form and entries. Tabulation would allow for more detailed form
//2nd and 3rd?
//Add option to extend the time with gifts or command
//remove panel-body padding for div that contains the form so the input layout will be condensed
// Optional setting (checkbox) "Lower rank priority" > when two users tie, the lower rank wins.
// Possibly send all duplicate entries via chatpm instead of in the general chat to avoid spam. This could also allow to send messages to notify that the entry was successful.
// Add more ! commands (!abort, !expandEntryRange, !pauseTimer, !resumeTimer)

// TODO
// Add version to menu
// Add command for !addTime, !removeBon, !kick, and !amilucky (tells your your current chances given the spread)

// BUGS
//Switching tabs reloads ALL messages in the cb, duplicating all BON gifts and spamming the chat. This can be achieved with the timestamps now included in the chatbox messages
//giveaway amount incorrect when BON donated after reset
// When doing a giveaway for 123 minutes, it will trigger a reminder right at the start (6 reminders, triggered at 2 hours, 2 minutes, 58 seconds)
//Modify timer so that timestamp is used in order to keep accuracy
// Validation of the entry range only sets one field red

var GENERAL_SETTINGS = {
  default_mins_per_reminder: 5,
  mins_per_reminder_limit: 3,
  disable_random: false,
  disable_lucky: false,
  disable_free: false,
}

// These settings can be used to test different portions of the script. By default, all should be set to false.
var DEBUG_SETTINGS = {
  log_chat_messages: false,
  disable_chat_output: false
}

const currentUrl = window.location.href

const chatboxID = "chatbox__messages-create"
var chatbox = null
var observer
var giveawayData
var numberEntries = new Map()
var fancyNames = new Map()
var regNum = /^-?\d+$/
var regGift = /([^ \n]+)\shas\sgifted\s([0-9.]+)\sBON\sto\s([^ \n]+)/
var whitespace = document.createTextNode(" ")

var coinsIcon = document.createElement("i")
coinsIcon.setAttribute("class", "fas fa-coins")

var goldCoins = document.createElement("i")
goldCoins.setAttribute("class", "fas fa-coins")
goldCoins.style.color = "#ffc00a"
goldCoins.style.padding = "5px"

var giveawayBTN = document.createElement("a")
giveawayBTN.setAttribute("class", "form__button form__button--text")
giveawayBTN.textContent = "Giveaway"
giveawayBTN.prepend(coinsIcon.cloneNode(false))
giveawayBTN.onclick = toggleMenu

var frameHTML = `
<section id="giveawayFrame" class="panelV2" style="width: 450px; height: 90%; position: fixed; z-index: 9999; inset: 50px 150px auto auto; overflow: auto; border-style: solid; border-width: 1px; border-color: black" hidden="true">
  <header class="panel__heading">
    <div class="button-holder no-space">
      <div class="button-left">
        <h4 class="panel__heading">
          <i class="fas fa-coins" style="padding: 5px;"></i>
          Giveaway Menu
        </h4>
      </div>
      <div class="button-right">
        <button id="resetButton" class="form__button form__button--text">
          Reset
        </button>
        <button id="closeButton" class="form__button form__button--text">
          Close
        </button>

         <button id="settingsButton" type="button" class="form__button form__button--text">
          Settings
        </button>
      </div>
    </div>
  </header>
  <div class="panel__body" id="giveaway_body">

    <div id="giveaway_settings_menu" class="giveaway_settings_menu" style="display: none">
      <div>
        <button type="button" id="toggleAllButton" class="form__button form__button--filled">
          Toggle all
        </button>
        <br>
        <p style="display: inline-block; box-sizing: content-box; margin: 5px; width: 100px;"> Random:</p>
        <input type="checkbox" id="randomToggle" style="width: 15px; height: 15px; cursor: pointer;" checked>
        <br>
        <p style="display: inline-block; box-sizing: content-box; margin: 5px; width: 100px;"> Lucky:</p>
        <input type="checkbox" id="luckyToggle" style="width: 15px; height: 15px; cursor: pointer;" checked>
        <br>
        <p style="display: inline-block; box-sizing: content-box; margin: 5px; width: 100px;"> Free:</p>
        <input type="checkbox" id="freeToggle" style="width: 15px; height: 15px; cursor: pointer;" checked>
      </div>
    </div>


    <h1 id="coinHeader" class="panel__heading--centered">
    </h1>
    <form class="form" id="giveawayForm" style="display: flex; flex-flow: column; align-items: center;">
      <p class="form__group" style="max-width: 35%;">
        <input class="form__text" required="" id="giveawayAmount" pattern="[0-9]*" value="" inputmode="numeric" type="text">
        <label class="form__label form__label--floating" for="giveawayAmount">
          Giveaway Amount
        </label>
      </p>
      <div class="panel__body" style="display: flex; justify-content: center; gap: 20px">
        <p class="form__group" style="width: 20%;">
          <input class="form__text" required="" id="startNum" pattern="[-]{0,1}[0-9]*" value="1" inputmode="numeric" type="text" maxlength="9">
          <label class="form__label form__label--floating" for="startNum">
            Start #
          </label>
        </p>
        <p class="form__group" style="width: 20%;">
          <input class="form__text" required="" id="endNum" pattern="[-]{0,1}[0-9]*" value="50" inputmode="numeric" type="text" maxlength="9">
          <label class="form__label form__label--floating" for="endNum">
            End #
          </label>
        </p>
      </div>
      <div class="panel__body" style="display: flex; justify-content: center; gap: 20px">
        <p class="form__group" style="width: 35%;">
        <input class="form__text" required="" id="timerNum" pattern="[0-9]*" value="10" inputmode="numeric" type="text">
        <label class="form__label form__label--floating" for="timerNum">
          Time (minutes)
        </label>
      </p>
        <p class="form__group" style="width: 35%;">
          <input class="form__text" required="" id="reminderNum" pattern="[0-9]*" value="1" inputmode="numeric" type="text">
          <label class="form__label form__label--floating" for="reminderNum">
            # of Reminders
          </label>
        </p>
      </div>
      <p class="form__group" style="text-align: center;">
        <button id="startButton" class="form__button form__button--filled">
          Start
        </button>
      </p>
    </form>
    <h2 id="countdownHeader" class="panel__heading--centered" hidden="">
    </h2>
    <div id="entriesWrapper" class="data-table-wrapper" hidden="">
      <table id="entriesTable" class="data-table">
        <thead>
          <tr>
            <th>
              User
            </th>
            <th>
              Entry #
            </th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  </div>
</section>
`

var settingsMenuStyle = `
        .giveaway_settings_menu {
          background-color: #2C2C2C;
          color: #CCCCCC;
          border-radius: 5px;
          position: absolute;
          top: 100px;
          right: 10px;
          z-index: 998;
          max-height: 260px;
          padding: 20px;
          overflow: auto;
          width: 240px;
          flex-direction: column;
          justify-content: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .giveaway_settings_menu > div {
          margin: 5px 0;
        }
        .giveaway_settings_menu #img_cb,
        .giveaway_settings_menu #autofill_cb,
        .giveaway_settings_menu #show_label {
          cursor: pointer;
        }/*# sourceMappingURL=style.css.map */
`

var giveawayFrame, resetButton, closeButton, coinHeader, coinInput, startInput, endInput, timerInput, reminderInput, startButton, countdownHeader, entriesWrapper, giveawayFrom, toggleAllButton, settingsButton
injectMenu()

function reminderAutoScaling() {

  var reminders = Math.floor(parseInt(timerInput.value)/GENERAL_SETTINGS.default_mins_per_reminder)-1

  if (reminders < 0) {
    reminderInput.value = 0
  } else {
    reminderInput.value = reminders
  }

  reminderInput.setCustomValidity("")

}

// This could be improved
function entryRangeValidation() {
  if (parseInt(startInput.value) > parseInt(endInput.value)) {
    startInput.setCustomValidity("Start # should be lower than End #")
    endInput.setCustomValidity("Start # should be lower than End #")
  } else {
    startInput.setCustomValidity("")
    endInput.setCustomValidity("")
  }
}

function remindersValidation() {
  if(timerInput.value/reminderInput.value < GENERAL_SETTINGS.mins_per_reminder_limit) {
    reminderInput.setCustomValidity(`There cannot be more than 1 reminder every: ${parseTime(GENERAL_SETTINGS.mins_per_reminder_limit*60000)}.`)
    reminderInput.reportValidity()
  } else {
    reminderInput.setCustomValidity("")
  }
}

function injectMenu() {
  var chatbox_header = document.querySelector(`#chatbox_header div`)

  if(chatbox_header == null) {
    // Chatbox hasnt loaded, so wait another 100ms before checking again
    setTimeout(function() {injectMenu()}, 100)

  } else {

    addStyle(settingsMenuStyle, "settings-menu-style")

    document.body.insertAdjacentHTML("beforeend", frameHTML)

    // New panel name
    chatbox_header.prepend(giveawayBTN)
    giveawayBTN.parentNode.insertBefore(whitespace, giveawayBTN.nextSibling)

    giveawayFrame = document.getElementById("giveawayFrame")
    resetButton = document.getElementById("resetButton")
    resetButton.onclick = resetGiveaway

    closeButton = document.getElementById("closeButton")
    closeButton.onclick = toggleMenu

    settingsButton = document.getElementById("settingsButton")
    settingsButton.onclick = toggleSettings

    const randomCheckbox = document.getElementById("randomToggle");
    randomCheckbox.checked = !GENERAL_SETTINGS.disbable_random
    randomCheckbox.addEventListener('change', function() { GENERAL_SETTINGS.disable_random = !randomCheckbox.checked; });

    const luckyCheckbox = document.getElementById("luckyToggle");
    luckyCheckbox.checked = !GENERAL_SETTINGS.disable_lucky
    luckyCheckbox.addEventListener('change', function() { GENERAL_SETTINGS.disable_lucky = !luckyCheckbox.checked; });

    const freeCheckbox = document.getElementById("freeToggle");
    freeCheckbox.checked = !GENERAL_SETTINGS.disable_free
    freeCheckbox.addEventListener('change', function() { GENERAL_SETTINGS.disable_free = !freeCheckbox.checked; });

    coinHeader = document.getElementById("coinHeader")
    coinHeader.textContent = document.getElementsByClassName("ratio-bar__points")[0].firstElementChild.textContent.trim()
    coinHeader.prepend(goldCoins.cloneNode(false))

    coinInput = document.getElementById("giveawayAmount")
    startInput = document.getElementById("startNum")
    endInput = document.getElementById("endNum")
    timerInput = document.getElementById("timerNum")
    reminderInput = document.getElementById("reminderNum")
    startButton = document.getElementById("startButton")
    startButton.onclick = startGiveaway

    toggleAllButton = document.getElementById("toggleAllButton")
    toggleAllButton.onclick = toggleAll

    countdownHeader = document.getElementById("countdownHeader")
    entriesWrapper = document.getElementById("entriesWrapper")
    giveawayForm = document.getElementById("giveawayForm")

    document.body.appendChild(giveawayFrame)

    // Attach event listener to scale the number of reminders automatically
    timerInput.addEventListener("input", function(){reminderAutoScaling()})

    // Add validation of the reminders to ensure that the frequency is not too high
    reminderInput.addEventListener("input", function() {remindersValidation()})

    // Add entry range validation to ensure endInput > startInput
    startInput.addEventListener("input", function(){entryRangeValidation()})
    endInput.addEventListener("input", function(){entryRangeValidation()})
  }
}

function toggleMenu() {
  giveawayFrame.hidden = !giveawayFrame.hidden
}

function startGiveaway() {
  if (!giveawayForm[0].checkValidity() || !giveawayForm[1].checkValidity() || !giveawayForm[2].checkValidity() || !giveawayForm[3].checkValidity() || !giveawayForm[4].checkValidity() || !giveawayForm[5].checkValidity()) {
    return;
  }

  // Chatbox isnt caught at the beginning when the script loads, so I moved it here for now
  if (chatbox == null) {
    chatbox = document.querySelector(`#${chatboxID}`)
  }

  startButton.disabled = true
  coinInput.disabled = true
  startInput.disabled = true
  endInput.disabled = true
  timerInput.disabled = true
  reminderInput.disabled = true

  startButton.parentElement.hidden = true
  entriesWrapper.hidden = false

  var totalTimeMs = timerInput.value * 60000

  var reminderNum = parseInt(reminderInput.value)

  // Using this to pass by reference
  giveawayData = {
    host: document.getElementsByClassName("top-nav__username")[0].children[0].textContent.trim(),
    amount: parseInt(coinInput.value),
    startNum: parseInt(startInput.value),
    endNum: parseInt(endInput.value),
    totalEntries: parseInt(endInput.value) - parseInt(startInput.value) + 1,
    winningNumber: null,
    totalSeconds: totalTimeMs / 1000,
    timeLeft: totalTimeMs / 1000,
    reminderNum: reminderNum,
    reminderFreqSec: (totalTimeMs / 1000 / (reminderNum + 1)).toFixed(0),
    sponsors: []
  }

  var currentBon = parseInt(document.getElementsByClassName("ratio-bar__points")[0].textContent.trim().replace(/\s/g, ''), 10)

  if (currentBon < giveawayData.amount) {
    window.alert(`GIVEAWAY ERROR: The amount entered (${giveawayData.amount}), is above your current BON (${currentBon}). You may need to refresh the page to update your BON amount.`)
    resetGiveaway(giveawayData)
  }
  else {
    giveawayData.winningNumber = getRandomInt(giveawayData.startNum, giveawayData.endNum)

    // Setup an alert when trying to exit the tab during a giveaway
    window.onbeforeunload = function () {
      return "Giveaway in progress"
    }

    var introMessage = `I am hosting a giveaway for [b][color=#ffc00a]${giveawayData.amount} BON[/color][/b]. Entries will be open for [b][color=#1DDC5D]${parseTime(totalTimeMs)}[/color][/b]. You may enter by submitting a whole number [b]between [color=#DC3D1D]${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive[/b]. ` + (currentUrl.includes("blutopia") ? ` . Note: [color=#999999][b]Any BON gifted to the host during the duration of the Giveaway is automatically added to the Pot![/b][/color]` : "" )

    sendMessage(introMessage)

    if (observer) {
      startObserver()
    }
    else {
      addObserver(giveawayData)
    }

    giveawayData.countdownTimerID = countdownTimer(countdownHeader, giveawayData)
  }

}

function addObserver(giveawayData) {
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      for (var i = 0; i < mutation.addedNodes.length; i++) {
        var tablist = document.querySelectorAll('[role="tablist"]');
        var general = tablist[0].childNodes[0]
        //console.log(general)
        //if(general.className != "panel__tab panel__tab--active") {
        //  console.log("General chat is not active")
        //}

        // !!! Here it is really important not to pass the giveawayData object to the parseMessage function. If done so, then it will for some reason always retain the pointer of the first
        // reference it was given, therefore when more than one giveaway is done in a row, the following giveaways messages will be parsed against the old giveawayData information.
        parseMessage(mutation.addedNodes[i])

      }
    })
  })

  startObserver()
}

function startObserver() {
  var messageList = document.getElementsByClassName("chatroom__messages")[0]

  observer.observe(messageList, {
    childList: true
  })
}

function parseMessage(messageNode) {

  var isBot = messageNode.querySelector(".chatbox-message__content") == null

  if (isBot) {
    var messageContent = messageNode.querySelector(".chatbox-message__header").querySelector("div").textContent.trim()
  }
  else {
    var author = messageNode.querySelector(".user-tag").textContent.trim()
    var messageContent = messageNode.querySelector(".chatbox-message__content").textContent.trim()
    var fancyName = messageNode.querySelector(".user-tag").outerHTML
  }

  if (regNum.test(messageContent)) {
    handleEntryMessage(parseInt(messageContent, 10), author, fancyName, giveawayData)
  }
  else if (isBot) {
    handleGiftMessage(messageContent, giveawayData)
  }
  else if (messageContent[0] == "!") {
    handleGiveawayCommands(author, messageContent, fancyName, giveawayData)
  }
}


function handleGiveawayCommands(author, messageContent, fancyName, giveawayData) {
  var arguments = messageContent.substring(1).trim().split(" ")
  var command = arguments[0].toLowerCase()

  if(command == "time") {
    var remainingTime = `Time left in the giveaway: [b][color=#1DDC5D]${parseTime(giveawayData.timeLeft*1000)}[/color][/b].`
    sendMessage(remainingTime)

  } else if (command == "help" || command == "commands") {
    var help = `Commands are ![color=#E50E68][b]random[/b][/color] - ![color=#E50E68][b]time[/b][/color] - ![color=#E50E68][b]free[/b][/color] - ![color=#E50E68][b]number[/b][/color] - ![color=#E50E68][b]lucky[/b][/color] - ![color=#E50E68][b]bon[/b][/color] - ![color=#E50E68][b]range[/b][/color] - ![color=#E50E68][b]help[/b][/color] - ![color=#E50E68][b]commands[/b][/color].`
    sendMessage(help)
  } else if (command == "bon") {
    var message = `Giveaway Amount: [b][color=#FFB700]${giveawayData.amount}[/color][/b]`
    sendMessage(message)
  } else if (command == "range") {
    var message = `Numbers between [color=#DC3D1D]${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive are valid.`
    sendMessage(message)

  } else if (command == "random") {
    if(GENERAL_SETTINGS.disable_random) {
      var message = `Sorry [color=#d85e27]${author}[/color], but [color=#999999]!random[/color] has been disabled for this giveaway.`
      sendMessage(message)
      return
    }
    userNumber = numberEntries.get(author)
    if(userNumber != undefined) {
      var message = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]you[/color] already entered with number [color=#DC3D1D][b]${userNumber}[/b][/color]!`
    } else {
      var randomNum = 0
      var currentNumbers = Array.from(numberEntries.values())
      do {
        randomNum = Math.floor(Math.random() * (giveawayData.endNum - giveawayData.startNum + 1)) + giveawayData.startNum;
      } while (currentNumbers.includes(randomNum));
      addNewEntry(author, fancyName, randomNum)
      var message = `[color=#d85e27]${author}[/color] has entered with the number [color=#DC3D1D][b]${randomNum}[/b][/color]!`

    }

    sendMessage(message)

  } else if (command == "number") {
    var userNumber = numberEntries.get(author)
    if(userNumber != undefined) {
      var message = `[color=#d85e27]${author}[/color] your number is [color=#DC3D1D][b]${userNumber}[/b][/color]`
    } else {
      var message = `[color=#d85e27]${author}[/color] you are not currently in the giveaway.`
    }
    sendMessage(message)

  } else if (command == "free") {
    if(GENERAL_SETTINGS.disable_free) {
      var disable_msg = `Sorry [color=#d85e27]${author}[/color], but [color=#999999]!free[/color] has been disabled for this giveaway.`
      sendMessage(disable_msg)
      return
    }
    var free = new Array()
    var numOfFreeToPrint = 5

    for (var k = giveawayData.startNum; k <= giveawayData.endNum; k++) {
        if (![...numberEntries.values()].includes(k)) {
            free.push(k)
        }
    }

    var randomValues = free.sort(() => Math.random() - 0.5).slice(0, numOfFreeToPrint)

    let freeNum = "Some Free Numbers: " + randomValues.join(", ") + "."
    sendMessage(freeNum)

  } else if (command == "lucky") {
    if(GENERAL_SETTINGS.disable_lucky) {
      var disable_msg = `Sorry [color=#d85e27]${author}[/color], but [color=#999999]!lucky[/color] has been disabled for this giveaway.`
      sendMessage(disable_msg)
      return
    }
    var luckyMessage = `The current giveaway lucky number is: [b][color=#1DDC5D]${getLuckyNumber(giveawayData)}[/color][/b].`
    sendMessage(luckyMessage)

  } else if (author == giveawayData.host) {
    // Here are the commands only the host can execute
    if(command == "addbon" || command == "add" || command == "addpot") {
      // .toFixed converts it into a string, therefore it is needed to parse it once again.
      var amount = parseFloat(arguments[1])

      if(!isNaN(amount) && amount > 0) {
         giveawayData.amount += amount

        var addMsg = `The host is adding [color=#DC3D1D][b]${amount}[/b][/color] BON to the pot! The total is now: [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]`
        sendMessage(addMsg)
      }
    } else if(command == "rig") {
      var msg = `[color=#DC3D1D][b]Giveaway is now rigged[/b][/color]`
      sendMessage(msg)
    } else if(command == "unrig") {
      var msg = `[color=#DC3D1D][b]No, the giveaway will be rigged[/b][/color]`
      sendMessage(msg)
    } else if(command == "reminder") {
      var reminderMessage = `There is an ongoing giveaway for [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]. Time left: [b][color=#1DDC5D]${parseTime(giveawayData.timeLeft*1000)}[/color][/b]. You may enter by submitting a whole number [b]between [color=#DC3D1D]${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive[/b] ` + (currentUrl.includes("blutopia") ? ` . Note: [color=#999999][b]Any BON gifted to the host during the duration of the Giveaway is automatically added to the Pot![/b][/color]` : "" )
      sendMessage(reminderMessage)
    } else if (command == "end") {
      endGiveaway(giveawayData)
    }
  }
}


function handleEntryMessage(number, author, fancyName, giveawayData) {
  var repeatMessage
  for (let [msgAuthor, msgValue] of numberEntries.entries()) {
    if (msgAuthor == author) {
      repeatMessage = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]you[/color] already entered with number [color=#DC3D1D][b]${msgValue}[/b][/color]!`
      sendMessage(repeatMessage)
      return;
    }
    else if (msgValue == number) {
      repeatMessage = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]${msgAuthor}[/color] already entered with number [color=#DC3D1D][b]${number}[/b][/color]! Please try another number!`
      sendMessage(repeatMessage)
      return;
    }
  }

  if (number < giveawayData.startNum || number > giveawayData.endNum) {
    var outOfBoundsMessage = `Sorry [color=#d85e27]${author}[/color], but the number [color=#DC3D1D][b]${number}[/b][/color] is outside of the given range! Enter a number between [color=#DC3D1D][b]${giveawayData.startNum}[/b] and [b]${giveawayData.endNum}[/b][/color]!`
    sendMessage(outOfBoundsMessage)
    return;
  }

  if (!numberEntries.has(author)) {
    addNewEntry(author, fancyName, number)
  }
}

function addNewEntry(author, fancyName, number) {
  numberEntries.set(author, number)
  fancyNames.set(author, fancyName)
  updateEntries()
}

function handleGiftMessage(messageContent, giveawayData) {

  // This throws a TypeError when there is no gift
  var gift = regGift.exec(messageContent)

  var addAmount = parseFloat(gift[2])
  var gifter = gift[1]
  var recpt = gift[3]

  if (recpt == giveawayData.host) {
    giveawayData.amount += addAmount

    var giftMessage = `[color=#1DDC5D][b]${gifter}[/b][/color] is sponsoring [color=#DC3D1D][b]${addAmount}[/b][/color] additional BON! The total pot is now: [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]`
    sendMessage(giftMessage)

    // If not yet included, add gifter to the list of giveaway sponsors
    if (!giveawayData.sponsors.includes(gifter)) {
      giveawayData.sponsors.push(gifter)
    }
  }
}

function updateEntries() {
  let tableStart = "<thead><tr><th>User</th><th>Entry #</th></tr></thead><tbody>"
  let tableEntries = ""
  let tableEnd = "</tbody>"

  numberEntries.forEach((entry, author) => {
    fancyName = fancyNames.get(author)
    tableEntries += `<tr><td>${fancyName}</td><td>${entry}</td></tr>`; //need ; to fix syntax highligthing
  })

  document.getElementById("entriesTable").innerHTML = tableStart + tableEntries + tableEnd
}

function endGiveaway(giveawayData) {
  observer.disconnect()

  if (numberEntries.size == 0) {
    var emptyMessage = `Unfortunately, no one has entered the giveaway so no one wins!`
    sendMessage(emptyMessage)
  } else {
    if (giveawayData.sponsors.length > 0) {
      var sponsorsMessage = `Thank you to all the additional sponsors! `
      sponsorsMessage += `[color=#1DDC5D][b]${giveawayData.sponsors[0]}[/b][/color]`
      var i = 1
      while (i < giveawayData.sponsors.length) {
        sponsorsMessage += `, [color=#1DDC5D][b]${giveawayData.sponsors[i]}[/b][/color]`
        i++
      }
      sendMessage(sponsorsMessage)
    }

    var bestGuess = Number.MAX_VALUE
    var tie = false
    var gapToWinningNumber, currentBestEntryGap
    var entryAuthor, tieAuthor, tieGuess
    numberEntries.forEach((entry, author) => {
      currentBestEntryGap = Math.abs(giveawayData.winningNumber - bestGuess)
      gapToWinningNumber = Math.abs(giveawayData.winningNumber - entry)
      if (currentBestEntryGap > gapToWinningNumber) {
        tie = false
        bestGuess = entry
        entryAuthor = author
      }
      else if (gapToWinningNumber == currentBestEntryGap) {
        tie = true
        tieAuthor = author
        tieGuess = entry
      }
    })

    if (bestGuess == giveawayData.winningNumber) {
      var winMessage = `With a guess of [color=#1DDC5D][b]${bestGuess}[/b][/color] hitting the winning number exactly, [color=#DC3D1D][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color]!`
      sendMessage(winMessage)
    }
    else if (!tie) {
      var winMessage = `With a guess of [color=#1DDC5D][b]${bestGuess}[/b][/color] only [color=#1DDC5D][b]${Math.abs(giveawayData.winningNumber - bestGuess)}[/b][/color] away from the winning number [color=#1DDC5D][b]${giveawayData.winningNumber}[/b][/color], [color=#DC3D1D][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color]!`
      sendMessage(winMessage)
    }
    else if (tie) {
      var tieMessage = `With a tie between [color=#d85e27][b]${entryAuthor}[/b][/color] ([b]${bestGuess}[/b]) and [color=#d85e27][b]${tieAuthor}[/b][/color] ([b]${tieGuess}[/b]), both being only [color=#1DDC5D][b]${Math.abs(giveawayData.winningNumber - bestGuess)}[/b][/color] away from the winning number [color=#1DDC5D][b]${giveawayData.winningNumber}[/b][/color], [color=#DC3D1D][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color] as their entry was submitted first!`
      sendMessage(tieMessage)
    }
    else {
      console.log("Something went wrong while ending the giveaway")
    }
    var giftMessage = `/gift ${entryAuthor} ${giveawayData.amount} Congratulations! You won the giveaway!`

    sendMessage(giftMessage)
  }

  // Clear onbeforeunload alert
  window.onbeforeunload = null
  clearInterval(giveawayData.countdownTimerID)
  observer.disconnect()
  delete giveawayData
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Unified all time related events in the countdown (endGiveaway and reminders) to avoid any kind of drifting between them.
function countdownTimer(display, giveawayData) {
  display.hidden = false
  var minutes, seconds
  var timerID = setInterval(function () {
    giveawayData.timeLeft--

    minutes = parseInt(giveawayData.timeLeft / 60, 10)
    seconds = parseInt(giveawayData.timeLeft % 60, 10)

    minutes = minutes < 0 ? "0" + minutes : minutes
    seconds = seconds < 10 ? "0" + seconds : seconds

    display.textContent = minutes + ":" + seconds

    if (giveawayData.timeLeft <= 0) {
      endGiveaway(giveawayData)
    }
    else if (giveawayData.totalEntries == numberEntries.size) {
      // Color scheme of this message could be improved
      var earlyFinishMessage = `All [b][color=#ffc00a]${giveawayData.totalEntries}[/color][/b] slot(s) filled up! Therefore, the giveaway is ending with [b][color=#1DDC5D]${parseTime(giveawayData.timeLeft*1000)}[/color][/b] remaining!`
      sendMessage(earlyFinishMessage)
      endGiveaway(giveawayData)

    }
    else if ((giveawayData.timeLeft) % giveawayData.reminderFreqSec == 0) {
      var reminderMessage = `There is an ongoing giveaway for [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]. Time left: [b][color=#1DDC5D]${parseTime(giveawayData.timeLeft*1000)}[/color][/b]. You may enter by submitting a whole number [b]between [color=#DC3D1D]${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive[/b]. ` + (currentUrl.includes("blutopia") ? ` . Note: [color=#999999][b]Any BON gifted to the host during the duration of the Giveaway is automatically added to the Pot![/b][/color]` : "" )
      sendMessage(reminderMessage)
    }
  }, 1000)

  return timerID
}

function sendMessage(messageStr) {
  if (!DEBUG_SETTINGS.disable_chat_output) {
    chatbox.value = messageStr
    chatbox.dispatchEvent(new KeyboardEvent("keydown", {
      keyCode: 13
    }))
  }

  if (DEBUG_SETTINGS.log_chat_messages) {
    console.log(messageStr)
  }

}

function getLuckyNumber(giveawayData) {
  var rangeStart = giveawayData.startNum
  var rangeEnd = giveawayData.endNum
  var numbers = Array.from(numberEntries.values()).sort((a,b) => {
    if (a<b) {
        return -1
    } else {
        return 1
    }
	})

  numbers.push(rangeEnd+1)

  var bestGap = 0
  var lucky = 0

  var pastNum = rangeStart-1
  var currentNum, gap
  for (var i = 0; i < numbers.length; i++) {
    currentNum = numbers[i]

    gap = currentNum - pastNum

    if(gap > bestGap) {
      lucky = Math.floor(gap/2)+pastNum
      bestGap = gap
    }

    pastNum = currentNum
  }

  return lucky

}

function cleanPotString(giveawayPotAmount) {
  if (giveawayPotAmount % 1 == 0) {
    return giveawayPotAmount
  } else {
    return giveawayPotAmount.toFixed(2)
  }
}

function parseTime(timeInMs) {
  var hours = Math.floor((timeInMs / 3600000) % 60)
  var minutes = Math.floor((timeInMs / 60000) % 60)
  var seconds = Math.floor((timeInMs / 1000) % 60)

  var timeString = ``

  if (hours > 0) {
    timeString += `${hours} hour`
    if (hours > 1) {
      timeString += `s`
    }
  }

  if (minutes > 0) {
    if (timeString != ``) {
      timeString += `, `
    }
    timeString += `${minutes} minute`
    if (minutes > 1) {
      timeString += `s`
    }
  }

  if (seconds > 0) {
    if (timeString != ``) {
      timeString += `, `
    }
    timeString += `${seconds} second`
    if (seconds > 1) {
      timeString += `s`
    }
  }

  return timeString
}

function resetGiveaway() {
  clearInterval(giveawayData.countdownTimerID)

  // Clear onbeforeunload alert
  window.onbeforeunload = null

  numberEntries = new Map()
  fancyNames = new Map()

  entriesWrapper.hidden = true
  countdownHeader.hidden = true
  startButton.parentElement.hidden = false

  startButton.disabled = false
  coinInput.disabled = false
  startInput.disabled = false
  endInput.disabled = false
  timerInput.disabled = false
  reminderInput.disabled = false

  observer.disconnect()
  delete observer

  giveawayForm.reset()

  updateEntries()
}

function toggleAll() {

    let newStatus = !GENERAL_SETTINGS.disable_random

    const randomCheckbox = document.getElementById("randomToggle");
    randomCheckbox.checked = !newStatus;
    GENERAL_SETTINGS.disable_random = newStatus;

    const luckyCheckbox = document.getElementById("luckyToggle");
    luckyCheckbox.checked = !newStatus;
    GENERAL_SETTINGS.disable_lucky = newStatus;

    const freeCheckbox = document.getElementById("freeToggle");
    freeCheckbox.checked = !newStatus;
    GENERAL_SETTINGS.disable_free = !newStatus;
}

function toggleSettings() {
  const giveawaySettingsMenu = document.getElementById("giveaway_settings_menu");
  const giveawayBody = document.getElementById('giveaway_body');

  if (giveawaySettingsMenu.style.display === "flex") {
    giveawaySettingsMenu.style.display = "none";
    giveawayBody.removeEventListener('click', handleBodyClick);
  } else {
    giveawaySettingsMenu.style.display = "flex";
    giveawayBody.addEventListener('click', handleBodyClick);
  }
}

function handleBodyClick(event) {
  const settings = document.getElementById('giveaway_settings_menu');
  if (!settings.contains(event.target)) {
      console.log("A")
    settings.style.display = 'none';
  }
}

function addStyle(css, id) {
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

