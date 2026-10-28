#!/usr/bin/env node
/**
 * Which SMTP host does this mailbox actually answer on?
 *
 * GoDaddy has sold mail under two different back ends, and a mailbox created
 * today may want either smtpout.secureserver.net or smtp.titan.email. Guessing
 * produces a timeout ten minutes later with nothing to go on, so this tries
 * the candidates and reports what each one says.
 *
 * Run it ON THE SERVER, where the relay path can also be tested:
 *   node deploy/smtp-verify.mjs hello@tryrepio.com
 * It prompts for the password and never takes it on the command line, because
 * an argument lands in the shell history and in the process list.
 *
 * Nothing is sent. This only opens the connection and authenticates.
 */
import nodemailer from 'nodemailer'
import { createInterface } from 'node:readline'

const user = process.argv[2]
if (!user) {
  console.error('Usage: node deploy/smtp-verify.mjs <mailbox@domain>')
  process.exit(1)
}

const CANDIDATES = [
  { host: 'smtp.titan.email', port: 587, auth: true },
  { host: 'smtpout.secureserver.net', port: 465, auth: true },
  { host: 'smtpout.secureserver.net', port: 587, auth: true },
  // No credentials at all: authorised by source IP, so this only succeeds
  // from the GoDaddy box itself.
  { host: 'relay-hosting.secureserver.net', port: 25, auth: false },
]

const pass = await prompt(`Password for ${user} (not echoed): `)
console.log()

let winner = null
for (const c of CANDIDATES) {
  const label = `${c.host}:${c.port}${c.auth ? '' : '  (no auth)'}`
  process.stdout.write(`  ${label.padEnd(44)}`)
  try {
    const t = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      ...(c.auth ? { auth: { user, pass } } : {}),
    })
    await t.verify()
    console.log('WORKS')
    winner ??= c
  } catch (e) {
    console.log(`no  — ${String(e.message).split('\n')[0]}`)
  }
}

console.log()
if (!winner) {
  console.log('None of them answered. Check the password first, then whether the')
  console.log('mailbox has SMTP sending enabled in the GoDaddy control panel.')
  process.exit(1)
}
console.log(`Use these in .env:\n  SMTP_HOST=${winner.host}\n  SMTP_PORT=${winner.port}`)
if (!winner.auth) console.log('  (leave SMTP_USER and SMTP_PASS blank)')

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  // Suppress the echo so a shoulder, or a screen share, does not get the password.
  const onData = () => { rl.output.write('\x1B[2K\x1B[200D' + question) }
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer) })
    rl.input.on('data', onData)
  })
}
