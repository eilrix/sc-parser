# Soundcloud parser

Collects all recent tracks from following profiles and makes a playlist

## Install
Node.js v12 or above

```sh
npm i soundcloud-following-parser
```

Create config.json as following: 
```javascript
{
    "email": "your_soundcloud_email",
    "password": "your_password",
    "target": "user-00000000",
    "timeRange": 12960000,
    "concurrency": 4
}
```

#### email
Email from Soundcloud account where playlist will be created. Create some fake account because it may get banned. 

#### password 
Password from the account

#### target
Target Soundcloud account to parse following users

#### timeRange
Collects tracks in a time range - from now and back on timeRange seconds, 5 months by default

#### concurrency
Specify number of browser tabs / threads for program to work

## Run

```sh
npx soundcloud-following-parser
```

Program will cache collected tracks in ./data/db.json, so next time it will collect only new tracks that were posted after previous run.  

Tracks that failed to add into a playlist by some reason (eg. playlist overflow, it can place only 500 tracks) will be cached also and it will try to add them to the end of a new playlist next time.