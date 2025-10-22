const { ethers } = require('ethers');

const EventChainABI = [
  "function createEvent(string eventName, string eventURI, string documentURI, uint256 eventDate, address[] revenueBeneficiaries, uint256[] percentages) external returns (uint256)",
  "function approveEvent(uint256 eventId) external",
  "function rejectEvent(uint256 eventId) external",
  "function addTicketType(uint256 eventId, string typeName, uint256 price, uint256 supply, uint256 saleStart, uint256 saleEnd) external returns (uint256)",
  "function updateTicketType(uint256 eventId, uint256 typeId, uint256 price, uint256 supply, uint256 saleStart, uint256 saleEnd, bool active) external",
  "function buyTickets(uint256 eventId, uint256 typeId, uint256 quantity) external payable",
  "function listTicketForResale(uint256 ticketId, uint256 resalePrice, uint256 resaleDeadline) external",
  "function buyResaleTicket(uint256 ticketId) external payable",
  "function cancelResaleListing(uint256 ticketId) external",
  "function useTicket(uint256 ticketId, uint256 eventId) external",
  "function deactivateEvent(uint256 eventId) external",
  "function getEventDetails(uint256 eventId) external view returns (tuple(uint256 eventId, address eventCreator, string eventName, string eventURI, string documentURI, uint256 eventDate, bool eventActive, uint8 status, uint256 createdAt, uint256 approvedAt))",
  "function getTicketDetails(uint256 ticketId) external view returns (tuple(uint256 ticketId, uint256 eventId, uint256 typeId, address currentOwner, bool isUsed, uint256 mintedAt, uint256 usedAt, bool isForResale, uint256 resalePrice, uint256 resaleDeadline, uint8 resaleCount))",
  "function getTicketType(uint256 eventId, uint256 typeId) external view returns (tuple(uint256 typeId, string typeName, uint256 price, uint256 totalSupply, uint256 sold, uint256 saleStartTime, uint256 saleEndTime, bool active))",
  "function getEventTicketTypes(uint256 eventId) external view returns (uint256[])",
  "function getRevenueShares(uint256 eventId) external view returns (tuple(address beneficiary, uint256 percentage)[])",
  "function getEOEvents(address eo) external view returns (uint256[])",
  "function getResaleTickets() external view returns (uint256[])",
  "function getUserTickets(address user) external view returns (uint256[])",
  "function getUserPurchaseCount(address user, uint256 eventId) external view returns (uint256)",
  "function canResell(uint256 ticketId) external view returns (bool)",
  "function getMaxResalePrice(uint256 ticketId) external view returns (uint256)",
  "function isAdmin(address user) external view returns (bool)",
  "event EventCreated(uint256 indexed eventId, address indexed creator, string eventName)",
  "event EventApproved(uint256 indexed eventId, address indexed creator)",
  "event EventRejected(uint256 indexed eventId, address indexed creator)",
  "event TicketTypeAdded(uint256 indexed eventId, uint256 indexed typeId, string typeName, uint256 price, uint256 supply)",
  "event TicketTypeUpdated(uint256 indexed eventId, uint256 indexed typeId, uint256 price, uint256 supply)",
  "event TicketMinted(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed typeId, address buyer)",
  "event TicketsPurchased(uint256 indexed eventId, uint256 indexed typeId, address indexed buyer, uint256 quantity, uint256 totalCost)",
  "event TicketListedForResale(uint256 indexed ticketId, uint256 resalePrice, uint256 deadline)",
  "event TicketResold(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address indexed user)"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  EventChainABI,
  provider
);

module.exports = {
  provider,
  contract,
  EventChainABI
};