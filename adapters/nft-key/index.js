require("dotenv").config();

const moment = require("moment");
const BigNumber = require("bignumber.js");
const Ethereum = require("../../sdk/EVMC");
const axios = require("axios");
const URL = "http://nft-sales-service.dappradar.com/open-source";
const KEY = process.env.DAPPRADAR_API_KEY;
const path = require("path");

class NFT_K {
    // stands for NFT Key
    constructor() {
        this.name = "NFTK";
        this.symbol = null;
        this.token = "0x0000000000000000000000000000000000000000";
        this.protocol = "AVAILABLE_PROTOCOLS.AVALANCHE";
        this.block = 12855192;
        this.contract = "0x1a7d6ed890b6c284271ad27e7abe8fb5211d0739";
        this.events = struct Listing {
            uint256 tokenId;
            uint256 value;
            address seller;
            uint256 expireTimestamp;
        }
        
        struct Bid {
            uint256 tokenId;
            uint256 value;
            address bidder;
            uint256 expireTimestamp;
        }
        
        event TokenListed(
            address indexed erc721Address,
            uint256 indexed tokenId,
            Listing listing
        );
        event TokenDelisted(
            address indexed erc721Address,
            uint256 indexed tokenId,
            Listing listing
        );
        event TokenBidEntered(
            address indexed erc721Address,
            uint256 indexed tokenId,
            Bid bid
        );
        event TokenBidWithdrawn(
            address indexed erc721Address,
            uint256 indexed tokenId,
            Bid bid
        );
        event TokenBought(
            address indexed erc721Address,
            uint256 indexed tokenId,
            address indexed buyer,
            Listing listing,
            uint256 serviceFee,
            uint256 royaltyFee
        );
        event TokenBidAccepted(
            address indexed erc721Address,
            uint256 indexed tokenId,
            address indexed seller,
            Bid bid,
            uint256 serviceFee,
            uint256 royaltyFee];
        this.pathToAbi = path.join(__dirname, "./abi.json");
        this.range = 500;
        this.chunkSize = 6;
        this.sdk = new Avalanche(this);
    }

    run = async () => {
        const s = await this.getSymbol();
        this.sdk = this.loadSdk();
        this.symbol = s;
        await this.sdk.run();
    };

    loadSdk = () => {
        return new Avalanche(this);
    };
    getSymbol = async () => {
        const resp = await axios.get(
            `${URL}/token-metadata?key=${KEY}&token_address=${this.token}&protocol=${this.protocol}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4619.141 Safari/537.36",
                },
            },
        );
        const symbol = resp.data;
        return symbol;
    };
    getPrice = async timestamp => {
        const resp = await axios.get(
            `${URL}/token-price?key=${KEY}&token_address=${this.token}&protocol=${this.protocol}&timestamp=${timestamp}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4619.141 Safari/537.36",
                },
            },
        );
        return resp.data;
    };
    stop = async () => {
        this.sdk.stop();
    };

    getBuyer = async event => {
        const buyer = event.returnValues.owner;
        if (event.event === "Offer, OfferCreated, OfferCancelled, OfferAccepted") {
            const txReceipt = await this.sdk.getTransactionReceipt(event.transactionHash);
            if (txReceipt === null) {
                return null;
            }
            return txReceipt.from;
        }
        return buyer;
    };

    process = async event => {
        const block = await this.sdk.getBlock(event.blockNumber);
        const timestamp = moment.unix(block.timestamp).utc();
        const po = await this.getPrice(block.timestamp);
        const nativePrice = new BigNumber(event.returnValues.cost).dividedBy(10 ** this.symbol.decimals);
        const buyer = await this.getBuyer(event);
        if (!buyer) {
            return;
        }

        const labelHash = event.returnValues.label;
        const tokenId = new BigNumber(labelHash, 16).toFixed();
        const entity = {
            provider_name: this.name, // the name of the folder
            provider_contract: this.contract, // the providers contract from which you get data
            protocol: this.protocol,
            nft_contract: this.contract,
            nft_id: tokenId,
            token: this.token,
            token_symbol: this.symbol.symbol,
            amount: 1,
            price: nativePrice.toNumber(),
            price_usd: nativePrice.multipliedBy(po.price).toNumber(),
            seller: this.contract, // Exchange happens on NFT Key
            buyer,
            sold_at: timestamp.format("YYYY-MM-DD HH:mm:ss"),
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
        };
        await this.addToDatabase(entity);
    };

    addToDatabase = async entity => {
        console.log(`creating sale for ${entity.nft_contract} with id ${entity.nft_id}`);
        return entity;
    };
}

module.exports = NFTKey;
