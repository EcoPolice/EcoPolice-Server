# EcoPolice-Server🏭
Server for EcoPolice app

### Run
`node index.js`  
or  
```bash
npm i pm2 -g
pm2 start index.js --watch
```

### Methods
* `GET /all` - returns all the disasters
* `GET /one/<id>` - returns certaint disaster by id
* `POST /upload` - uploads photos of disaster
* `POST /add` - adds new disaster
