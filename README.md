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

### Database
```SQL
create table main
(
    id                  int auto_increment,
    disasterName        text   not null,
    disasterDescription text   null,
    disasterDate        bigint null,
    lat                 float  null,
    `long`              float  null,
    objectName          text   null,
    owner               text   null,
    cause               text   null,
    product             text   null,
    volume              int    null,
    area                int    null,
    damageCount        int    null,
    damagedObjects      text   null,
    images              text   null,
    constraint main_id_uindex
        unique (id)
);

alter table main
    add primary key (id);
```
