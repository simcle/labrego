const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const {Server} = require('socket.io');
const excel = require('exceljs')
app.use(cors())
app.use(express.json())

const sqlite3 = require('sqlite3').verbose()
let client = false
let sql;

const db = new sqlite3.Database('./logger.db', sqlite3.OPEN_READWRITE, (err) => {
    if(err) return console.log(err.message)
})

// // CREATE TABLE
sql = 'CREATE TABLE IF NOT EXISTS logger(id INTEGER PRIMARY KEY, temp REAL, waterTemp REAL, tds REAL, hum REAL, created_at TEXT)'
db.run(sql)

// DROP TABLE
// sql = 'DROP TABLE logger'
// db.run(sql)

const logger = {
    temp: 0.00,
    waterTemp: 0.00,
    tds: 0.00,
    hum: 0.00
}

const io = new Server(server, {
    cors: {
        origin: '*'
    }
})

io.on('connection', (socket) => {
    const token = socket.handshake.auth.token
    if(token != 'web') {
        io.emit('client', true)
        client = true
    }
    socket.on('disconnect', () => {
        if(token != 'web') {
            client = false
            io.emit('client', false)
        }
    }) 
    socket.on('logger', data => {
        io.emit('data', data)
        logger.temp = data.temp
        logger.waterTemp = data.waterTemp
        logger.tds = data.tds
        logger.hum = data.hum
        logger.date = new Date()
        io.emit('client', true)
    })
});

setInterval(() => {
    const time = new Date()
    let Y = time.getFullYear()
    let M = time.getMonth() +1
    let D = time.getDate() 
    let hh  = time.getHours()
    let mm = time.getMinutes()
    let ss = time.getSeconds()
    M = chekTime(M)
    D = chekTime(D)
    hh = chekTime(hh) 
    mm = chekTime(mm)
    ss = chekTime(ss)
    function chekTime(i) {
        if(i < 10) {
            i = `0${i}`
        }
        return i
    }
    let d = `${Y}-${M}-${D} ${hh}:${mm}:${ss}`
    sql = 'INSERT INTO logger(temp, waterTemp, tds, hum, created_at) VALUES(?,?,?,?,?)'
    
    if(client && mm == 00 && ss == 00) {
        db.run(sql, [logger.temp, logger.waterTemp, logger.tds, logger.hum, d], (err) => {
            if(err) return console.log(err.message)
        })
    }
}, 1000)

app.get('/data', (req, res) => {
    let totalItems;
    const currentPage = req.query.page || 1;
    const perPage = 20
    const date = req.query.date
    const label = req.query.label
    let page = (currentPage -1) * perPage
    if(label == 'Hari ini') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE date(created_at) = '${date}'`
    }
    if(label == 'Kemarin') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE date(created_at) = date('${date}','-1 day') `
    }
    if(label == '7 Hari terakhir') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE date(created_at) > date('${date}','-8 day') `
    }
    if(label == '30 Hari terakhir') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE date(created_at) > date('${date}','-31 day') `
    }
    if(label == 'Bulan ini') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE strftime('%Y-%m',created_at) = '${date}' `
    }
    if(label == 'Per Hari') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE strftime('%Y-%m-%d',created_at) = '${date}' `
    }
    if(label == 'Per Bulan') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE strftime('%Y-%m',created_at) = '${date}' `
    }
    if(label == 'Per Tahun') {
        sql = `SELECT COUNT(*) as count FROM logger WHERE strftime('%Y',created_at) = '${date}' `
    }
    db.all(sql, (err, row) => {
        if(err) return res.status(400).send(err.message)
        if(row.length > 0) {
            totalItems = row[0].count
            if(label == 'Hari ini') {
                sql = `SELECT * FROM logger WHERE date(created_at) = '${date}' ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == 'Kemarin') {
                sql = `SELECT * FROM logger WHERE date(created_at) = date('${date}','-1 day')  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == '7 Hari terakhir') {
                sql = `SELECT * FROM logger WHERE date(created_at) > date('${date}','-8 day')  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == '30 Hari terakhir') {
                sql = `SELECT * FROM logger WHERE date(created_at) > date('${date}','-31 day')  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == 'Bulan ini') {
                sql = `SELECT * FROM logger WHERE strftime('%Y-%m',created_at) = '${date}'  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == 'Per Hari') {
                sql = `SELECT * FROM logger WHERE strftime('%Y-%m-%d',created_at) = '${date}'  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == 'Per Bulan') {
                sql = `SELECT * FROM logger WHERE strftime('%Y-%m',created_at) = '${date}'  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            if(label == 'Per Tahun') {
                sql = `SELECT * FROM logger WHERE strftime('%Y',created_at) = '${date}'  ORDER BY id DESC LIMIT ${perPage} OFFSET ${page}`
            }
            db.all(sql, (err, row) => {
                if(err) return res.status(400).send(err.message)
                const last_page = Math.ceil(totalItems / perPage)
                res.status(200).json({
                    data: row,
                    pages: {
                        current_page: currentPage,
                        last_page: last_page
                    }
                })
            })
            
        }
    })
})

app.get('/download', (req, res) => {
    const date = req.query.date;
	const label = req.query.label;
    let workbook = new excel.Workbook()
	let worksheet = workbook.addWorksheet('laporan')
    worksheet.columns = [
		{key: 'created_at', width: 25},
		{key: 'temp',  width: 10},
		{key: 'waterTemp',  width: 10},
		{key: 'tds',  width: 10},
		{key: 'hum',  width: 10},
	]
    if(label == 'Hari ini') {
        sql = `SELECT * FROM logger WHERE date(created_at) = '${date}' ORDER BY id DESC`
    }
    if(label == 'Kemarin') {
        sql = `SELECT * FROM logger WHERE date(created_at) = date('${date}','-1 day')  ORDER BY id DESC`
    }
    if(label == '7 Hari terakhir') {
        sql = `SELECT * FROM logger WHERE date(created_at) > date('${date}','-8 day')  ORDER BY id DESC`
    }
    if(label == '30 Hari terakhir') {
        sql = `SELECT * FROM logger WHERE date(created_at) > date('${date}','-31 day')  ORDER BY id DESC`
    }
    if(label == 'Bulan ini') {
        sql = `SELECT * FROM logger WHERE strftime('%Y-%m',created_at) = '${date}'  ORDER BY id DESC`
    }
    if(label == 'Per Hari') {
        sql = `SELECT * FROM logger WHERE strftime('%Y-%m-%d',created_at) = '${date}'  ORDER BY id DESC`
    }
    if(label == 'Per Bulan') {
        sql = `SELECT * FROM logger WHERE strftime('%Y-%m',created_at) = '${date}'  ORDER BY id DESC`
    }
    if(label == 'Per Tahun') {
        sql = `SELECT * FROM logger WHERE strftime('%Y',created_at) = '${date}'  ORDER BY id DESC`
    }
    db.all(sql, async (err, row) => {
        if(err) return res.status(400).send(err.message)
        worksheet.getColumn('B').numFmt = '0.00'
        worksheet.getColumn('C').numFmt = '0.00'
        worksheet.getColumn('D').numFmt = '0.00'
        worksheet.getColumn('E').numFmt = '0.00'
        worksheet.getRow(1).values = [label]
        worksheet.getRow(3).values = ['Tanggal', 'SUHU RUANGAN', 'SUHU AIR SIRKULASI','TDS', 'HUMIDITY']
        worksheet.addRows(row)
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "tutorials.xlsx"
        );
        await workbook.xlsx.write(res);
		res.status(200).end();
    })
})

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('listening on ' +PORT)
})
