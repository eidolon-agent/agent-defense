// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentNFT - Tower Defense Agent NFTs with evolution tracking
/// @notice Each agent is an autonomous tower with on-chain evolution
contract AgentNFT is ERC721, Ownable {
    struct Agent {
        uint8 agentType;       // 0=Defender, 1=Sniper
        uint8 personality;     // 0=Balanced, 1=Aggressive, 2=Defensive, 3=Calculated
        uint32 level;
        uint32 xp;
        uint32 wins;
        uint32 losses;
        uint64 lastTrainedAt;
        bytes32 behaviorHash;  // Off-chain brain pointer (IPFS hash)
    }

    mapping(uint256 => Agent) public agents;
    uint256 private _nextTokenId = 1;
    address public gameServer;

    modifier onlyGameServer() {
        require(msg.sender == gameServer, "not game server"); _;
    }

    event AgentMinted(uint256 indexed id, uint8 agentType, uint8 personality, address indexed owner);
    event AgentProgressed(uint256 indexed id, uint32 xp, uint32 wins, uint32 losses);
    event AgentEvolved(uint256 indexed id, bytes32 behaviorHash);

    constructor() ERC721("Agent Defense", "AGDF") Ownable(msg.sender) {}

    function setGameServer(address _s) external onlyOwner { gameServer = _s; }

    function mint(uint8 agentType, uint8 personality) external returns (uint256) {
        require(agentType <= 1, "invalid type");
        require(personality <= 3, "invalid personality");
        uint256 id = _nextTokenId++;
        _safeMint(msg.sender, id);
        agents[id] = Agent(agentType, personality, 1, 0, 0, 0, uint64(block.timestamp), bytes32(0));
        emit AgentMinted(id, agentType, personality, msg.sender);
        return id;
    }

    function getAgent(uint256 id) external view returns (Agent memory) {
        require(_ownerOf(id) != address(0), "nonexistent");
        return agents[id];
    }

    function updateProgress(uint256 id, uint32 xp, uint32 wins, uint32 losses) external onlyGameServer {
        require(_ownerOf(id) != address(0), "nonexistent");
        Agent storage a = agents[id];
        a.xp += xp; a.wins += wins; a.losses += losses;
        uint32 nl = 1 + (a.xp / 100);
        if (nl > a.level) a.level = nl;
        emit AgentProgressed(id, a.xp, a.wins, a.losses);
    }

    function updateBehavior(uint256 id, bytes32 bh) external onlyGameServer {
        require(_ownerOf(id) != address(0), "nonexistent");
        Agent storage a = agents[id];
        a.behaviorHash = bh;
        a.lastTrainedAt = uint64(block.timestamp);
        emit AgentEvolved(id, bh);
    }
}
