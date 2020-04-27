const { JsonRpc, Api } = require('eosjs')

const fetch = require('node-fetch')
const util = require('util')
const zlib = require('zlib')
const express = require('express')
const app = express()
const port = 3000
const { SigningRequest } = require("eosio-signing-request");
const { RicardianContractFactory } = require('ricardian-template-toolkit');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const Handlebars = require("handlebars");

const textEncoder = new util.TextEncoder()
const textDecoder = new util.TextDecoder()

const rpc = new JsonRpc('https://eos.greymass.com', {
    fetch // only needed if running in nodejs, not required in browsers
})

const eos = new Api({
    rpc,
    textDecoder,
    textEncoder,
})

// options for the signing request
const opts = {
    // string encoder
    textEncoder,
    // string decoder
    textDecoder,
    // zlib string compression (optional, recommended)
    zlib: {
        deflateRaw: (data) => new Uint8Array(zlib.deflateRawSync(Buffer.from(data))),
        inflateRaw: (data) => new Uint8Array(zlib.inflateRawSync(Buffer.from(data))),
    },
    // Customizable ABI Provider used to retrieve contract data
    abiProvider: {
        getAbi: async (account) => (await eos.getAbi(account))
    }
}

app.get('/decode', async (req, res) => {
    res.send('you need to post');
});

app.post('/decode', async (req, res) => {

    console.log(req.body);
    const decoded = SigningRequest.from(req.body.esrUri, opts)

    // Fetch the ABIs needed for decoding
    const abis = await decoded.fetchAbis();

    // In order to resolve the transaction, we need a recent block to form it into a signable transaction
    const head = (await rpc.get_info(true)).head_block_num;
    const block = await rpc.get_block(head);

    const contractName = decoded.data.req[1].account;
    const actionName = decoded.data.req[1].name;

    // Resolve the transaction as a specific user
    const resolved = await decoded.resolve(abis, req.body.authorization, block);
    const esr = util.inspect(resolved, false, null, true);

    // const ricardianTemplate = abis.get('eosio.token').actions.filter(a => a.name === 'transfer')[0].ricardian_contract;
    const factory = new RicardianContractFactory();
    const config = {
        abi: abis.get(contractName),
        transaction: resolved.transaction,
        actionIndex: 0
    }

    const ricardianContract = factory.create(config);
    const metadata = ricardianContract.getMetadata();
    const html = ricardianContract.getHtml();

    var returnTrx = {};
    returnTrx.ricardianHtml = html;
    returnTrx.ricardianMetadata = metadata;
    returnTrx.transaction = resolved.transaction;

    console.log(JSON.stringify(returnTrx, null, 2));

    res.send(returnTrx);
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))
