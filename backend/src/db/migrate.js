'use strict'

require('dotenv').config()

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  console.log(`Running ${files.length} migration(s)...`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await pool.query(sql)
      console.log(`✅ ${file}`)
    } catch (err) {
      console.error(`❌ ${file}:`, err.message)
      process.exit(1)
    }
  }

  console.log('All migrations completed.')
  await pool.end()
}

migrate()
