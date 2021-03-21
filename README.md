# Soundcloud parser

Collects all recent tracks from flollowing profiles and make a playlist

## Install
Node.js v12 or above

```sh
npm i soundcloud-following-parser
```

Create config.json as following: 
```javascript
{
    "email": "you_soundcloud_email",
    "password": "your_password",
    "target": "user-00000000",
    "concurrency": 4,
    "timeRange": 12960000
}
```

##### email
Email from Soundcloud account where playlist will be created. Create some fake account because it may get banned. 

#### password 
Password from the account

#### target
Target Soundcloud account to parse following users

#### timeRange
Collects tracks in a time range - from now and back on timeRange seconds, 5 month by default

#### concurrency
Specify number of browser tabs / threads for program to work

## Run

```sh
npx soundcloud-following-parser
```