# gcal-slack-sync
A simple and messy NodeJS script to sync Google Calendar with Slack presence.


# To run:

1) Make sure you have Node installed.
2) Navigate to the directory you plan to run the app from.
3) Install the Google API package for NodeJS:  `npm install @slack/client`
4) Install the Slack Client package for NodeJS: `npm install @slack/client`
5) Obtain a Slack refresh token with access privilege to `dnd:write` and `users.profile:write`
6) Copy the refresh token into the `SLACK_TOKEN` environment variable for your system
7) Go to https://developers.google.com/calendar/quickstart/nodejs and follow the instructions to obtain a `credentials.json` file.
8) Copy this `credentials.json` file into your app directory.
9) Run the app with `node .` in the app directory.
10) When prompted, grant Google with the access privileges request.
11) The app should continue by syncing your Google Calendar events with your Slack presence.
12) Subsequent runs of the app should correctly sync your Google Calendar with your Slack presence.
