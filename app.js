const cheerio = require('cheerio')
const fetch = require('node-fetch')
const fs = require('fs')

async function run() {
  fetch('https://www.matchi.se/facilities/findFacilities', {
    credentials: 'include',
    headers: {
      accept: '*/*',
      'accept-language':
        'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7,nb;q=0.6,de;q=0.5,fr;q=0.4,da;q=0.3,fi;q=0.2',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest'
    },
    referrer:
      'https://www.matchi.se/facilities/index?q=Stockholm&municipality=&sport=&lng=17.988092899999998&offset=10&lat=59.3074203&max=10',
    referrerPolicy: 'no-referrer-when-downgrade',
    body:
      'lat=59.3074203&lng=17.988092899999998&offset=10&q=Stockholm&municipality=&sport=&max=1000',
    method: 'POST',
    mode: 'cors'
  })
    .then(res => {
      return res.text()
    })
    .then(text => {
      const $ = cheerio.load(text)
      $('facilities-result').html()
      return $('.panel.panel-default.no-border.no-box-shadow.bottom-border')
        .map(function() {
          const imageSrc = $(this).find(
            'div > div.row > div.col-sm-5 > div > div.media-left > div > a > img'
          )[0].attribs.src
          const name = $(this)
            .find(
              'div > div.row > div.col-sm-5 > div > div.media-body.facility-info-text > h3 > a'
            )
            .text()
            .trim()
          const subLocation = $(this)
            .find(
              'div > div.row > div.col-sm-5 > div > div.media-body.facility-info-text > p'
            )
            .text()
            .trim()
            .replace(/<\/?[^>]+(>|$)/g, '')

          const favouriteUrl = $(this)
            .find(
              'div > div.row > div.col-sm-5 > div > div.media-right > span > a'
            )[0]
            .attribs.href.trim()
          const [, res] = favouriteUrl.split('facilityId=')
          const facilityId = res.substring(0, res.indexOf('&'))

          return {
            location: 'Stockholm',
            facilityId,
            subLocation,
            name,
            imageSrc
          }
        })
        .get()
    })
    .then(async clubs => {
      const existingClubs = await fetch(
        'https://tennistider-api.herokuapp.com/api/club/v2/list'
      ).then(res => res.json())

      const existingMatchiClubs = existingClubs.filter(
        ({ tag }) => tag === 'matchi'
      )
      const result = existingMatchiClubs.map(
        ({ tag, tagName, ...existingClub }) => {
          const club = clubs.find(
            ({ facilityId }) => facilityId === existingClub.facilityId
          )
          return { ...existingClub, subLocation: '', ...club }
        }
      )
      const maxId = result.reduce((max, curr) => Math.max(curr.id, max), 0) + 1

      clubs
        .filter(
          ({ facilityId }) => !result.some(c => c.facilityId === facilityId)
        )
        .forEach((c, i) => {
          result.push({ ...c, id: maxId + i })
        })

      result.forEach(c => {
        if (c.subLocation === c.location) {
          c.subLocation = ''
        }
      })

      fs.writeFileSync('./output.json', JSON.stringify(result), 'utf8')
    })
}

run()
