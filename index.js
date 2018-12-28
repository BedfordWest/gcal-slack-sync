const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const { WebClient } = require('@slack/client');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
 
// An access token (from your Slack app or custom integration - xoxa, xoxp, or xoxb)
const token = process.env.SLACK_TOKEN;
 
const web = new WebClient(token);

var oneMinuteLater = new Date();
oneMinuteLater.setMinutes(oneMinuteLater.getMinutes() + 1);

var busyStatus = {
    "profile": {
        "status_text": "In a meeting!",
        "status_emoji": ":no_bell:",
        "status_expiration": oneMinuteLater.toISOString(),
    }
};

var PTOStatus = {
    "profile": {
        "status_text": "I'm currently out of the office.",
        "status_emoji": ":pto:",
        "status_expiration": 0,
    }
}

var freeStatus = {
    "profile": {
        "status_text": "*ribbit*",
        "status_emoji": ":frog:",
        "status_expiration": 0,
    }
};

var dndBody = {
    "num_minutes": 0,
};
 
// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  var twoMinutesLater = new Date();
  twoMinutesLater.setMinutes(twoMinutesLater.getMinutes() + 2);
  var longestTime;
  var dndDuration;
  var inMeeting = false;
  var onPTO = false;
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    timeMax: twoMinutesLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    fields: {items: "attendees", items: "organizer"},
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Looking through events for attendees:');
      events.map((event, i) => {
          const eventSummary = event.summary.toLowerCase();
        if(eventSummary.includes("pto") || eventSummary.includes("vacation") || eventSummary.includes("ooo")) {
            onPTO = true;
            return;
        }  
        if(event.attendees) {
            var attendees = [];
            const start = event.start.dateTime || event.start.date;
            const end = event.end.dateTime || event.end.date;
            event.attendees.map((attendee, i) => {
                if(!(attendee.email.includes("sproutsocial.com_")) && !attendee.organizer) {
                    attendees.push(attendee);
                }
            });
            if(attendees.length > 0) {
              var endTime = Date.parse(end)/1000;
              if(longestTime == undefined || endTime > longestTime) {
                  longestTime = endTime;
                  console.log(`Setting longestTime to: ${longestTime}`);
                  dndDuration = Math.ceil((longestTime - Date.now()/1000)/60);
                  console.log(`DnD duration is: ${dndDuration} minutes!`);
              }
              console.log(`Making Slack call to set status to busy!`);
              inMeeting = true;
              attendees.map((attendee, i) => {
                  if(attendee.displayName) {
                    console.log(`Attendee is ${attendee.displayName}`);
                  }
                  else {
                    console.log(`Attendee is ${attendee.email}`);
                  }
              });
            }
            console.log(`${start} - ${event.summary} - ${longestTime}`);
        }
      });
    } else {
      console.log('No upcoming events found.');
    }
    if(onPTO) {
	dndBody.num_minutes = 60;
        setDnD();
        setProfileStatus(PTOStatus);
    }
    else if(inMeeting) {
        busyStatus.profile.status_expiration = longestTime;
        dndBody.num_minutes = dndDuration;
        setDnD();
        setProfileStatus(busyStatus);
      }
    else {
        clearDnD();
        setProfileStatus(freeStatus);
    }
  });
}

function setProfileStatus(status) {
    console.log(`At time of setting Slack status, expiration time was ${JSON.stringify(status)}`);
    web.users.profile.set(status)
    .then((res) => {
        console.log('Profile status set to: ', res.profile.status_text);
      })
      .catch(console.error);
}

function setDnD() {
    web.dnd.setSnooze(dndBody)
    .then((res) => {
        console.log('DnD status set to: ', JSON.stringify(res));
      })
      .catch(console.error);
}

function clearDnD() {
    web.dnd.endDnd()
    .then((res) => {
        console.log('DnD status set to: ', JSON.stringify(res));
      })
      .catch(console.error);
}
