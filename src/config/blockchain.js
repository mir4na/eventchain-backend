const { ethers } = require('ethers');

const EventTicketNFTABI = [
  "function mintTicket(address to, uint256 eventId, uint256 typeId, uint256 originalPrice, address eventCreator) external returns (uint256)",
  "function listForResale(uint256 tokenId, uint256 resalePrice, uint256 resaleDeadline) external",
  "function buyResaleTicket(uint256 tokenId) external payable",
  "function cancelResaleListing(uint256 tokenId) external",
  "function useTicket(uint256 tokenId) external",
  "function getTicketInfo(uint256 tokenId) external view returns (tuple(uint256 eventId, uint256 typeId, uint256 originalPrice, uint256 mintedAt, bool isUsed, uint256 usedAt, bool isForResale, uint256 resalePrice, uint256 resaleDeadline, uint256 resaleCount, address eventCreator))",
  "function isTicketUsed(uint256 tokenId) external view returns (bool)",
  "function canResell(uint256 tokenId) external view returns (bool)",
  "function getMaxResalePrice(uint256 tokenId) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function setAuthorizedMinter(address minter, bool authorized) external",
  "event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, uint256 indexed typeId, address to, uint256 originalPrice)",
  "event TicketResold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price)",
  "event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId)",
  "event TicketListedForResale(uint256 indexed tokenId, uint256 resalePrice, uint256 deadline)",
  "event ResaleListingCancelled(uint256 indexed tokenId)"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  EventTicketNFTABI,
  provider
);

module.exports = {
  provider,
  contract,
  EventTicketNFTABI
};