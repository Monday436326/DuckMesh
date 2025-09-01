// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuckToken.sol";

contract ProviderRegistry is ReentrancyGuard, Ownable {
    DuckToken public immutable duckToken;
    
    struct Provider {
        address owner;
        string pubkey;
        string endpoint;
        string metadataURI;
        uint256 stakedAmount;
        uint256 reputation;
        uint256 totalJobs;
        uint256 successfulJobs;
        uint256 lastHeartbeat;
        bool isActive;
    }
    
    mapping(address => Provider) public providers;
    mapping(string => address) public pubkeyToProvider;
    address[] public providerList;
    
    uint256 public constant MIN_STAKE = 1000 * 10**18; // 1000 DUCK
    uint256 public constant HEARTBEAT_TIMEOUT = 1 hours;
    
    event ProviderRegistered(address indexed provider, string pubkey, uint256 stake);
    event ProviderUnstaked(address indexed provider, uint256 amount);
    event ProviderSlashed(address indexed provider, uint256 amount, string reason);
    event HeartbeatReceived(address indexed provider, uint256 timestamp);
    
    constructor(address _duckToken, address initialOwner) Ownable(initialOwner) {
        duckToken = DuckToken(_duckToken);
    }
    
    function registerProvider(
        string calldata pubkey,
        string calldata endpoint,
        string calldata metadataURI,
        uint256 stakeAmount
    ) external nonReentrant {
        require(stakeAmount >= MIN_STAKE, "Insufficient stake");
        require(providers[msg.sender].owner == address(0), "Provider already registered");
        require(pubkeyToProvider[pubkey] == address(0), "Pubkey already used");
        
        require(
            duckToken.transferFrom(msg.sender, address(this), stakeAmount),
            "Stake transfer failed"
        );
        
        providers[msg.sender] = Provider({
            owner: msg.sender,
            pubkey: pubkey,
            endpoint: endpoint,
            metadataURI: metadataURI,
            stakedAmount: stakeAmount,
            reputation: 100, // Start with base reputation
            totalJobs: 0,
            successfulJobs: 0,
            lastHeartbeat: block.timestamp,
            isActive: true
        });
        
        pubkeyToProvider[pubkey] = msg.sender;
        providerList.push(msg.sender);
        
        emit ProviderRegistered(msg.sender, pubkey, stakeAmount);
    }
    
    function unstake() external nonReentrant {
        Provider storage provider = providers[msg.sender];
        require(provider.owner == msg.sender, "Not provider owner");
        require(provider.isActive, "Provider not active");
        
        uint256 amount = provider.stakedAmount;
        provider.stakedAmount = 0;
        provider.isActive = false;
        
        require(duckToken.transfer(msg.sender, amount), "Unstake transfer failed");
        
        emit ProviderUnstaked(msg.sender, amount);
    }
    
    function heartbeat(bytes calldata signature, uint256 blockNumber) external {
        Provider storage provider = providers[msg.sender];
        require(provider.owner == msg.sender, "Not provider owner");
        require(provider.isActive, "Provider not active");
        require(blockNumber <= block.number, "Future block number");
        require(blockNumber >= block.number - 10, "Block number too old"); // Allow up to 10 blocks old
        require(block.timestamp >= provider.lastHeartbeat + 60, "Heartbeat too frequent"); // Minimum 1 minute between heartbeats
        
        // Create message hash for signature verification
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            blockNumber,
            block.chainid,
            address(this)
        ));
        
        // Verify ECDSA signature against provider's registered public key
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        address recoveredSigner = _recoverSigner(ethSignedMessageHash, signature);
        address expectedSigner = _pubkeyToAddress(provider.pubkey);
        require(recoveredSigner == expectedSigner, "Invalid signature");
        
        provider.lastHeartbeat = block.timestamp;
        
        emit HeartbeatReceived(msg.sender, block.timestamp);
    }
    
    function _recoverSigner(bytes32 hash, bytes memory signature) private pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature recovery id");
        
        return ecrecover(hash, v, r, s);
    }
    
    function _pubkeyToAddress(string memory pubkey) private pure returns (address) {
        // Convert hex string to bytes
        bytes memory pubkeyBytes = _hexStringToBytes(pubkey);
        require(pubkeyBytes.length == 64, "Invalid pubkey length");
        
        // Hash the public key and take last 20 bytes for address
        bytes32 hash = keccak256(pubkeyBytes);
        return address(uint160(uint256(hash)));
    }
    
    function _hexStringToBytes(string memory hexString) private pure returns (bytes memory) {
        // Remove '0x' prefix if present
        uint256 startIndex = 0;
        if (bytes(hexString).length >= 2 && 
            bytes(hexString)[0] == '0' && 
            (bytes(hexString)[1] == 'x' || bytes(hexString)[1] == 'X')) {
            startIndex = 2;
        }
        
        uint256 length = (bytes(hexString).length - startIndex) / 2;
        bytes memory result = new bytes(length);
        
        for (uint256 i = 0; i < length; i++) {
            uint8 high = _hexCharToUint8(bytes(hexString)[startIndex + i * 2]);
            uint8 low = _hexCharToUint8(bytes(hexString)[startIndex + i * 2 + 1]);
            result[i] = bytes1(high * 16 + low);
        }
        
        return result;
    }
    
    function _hexCharToUint8(bytes1 char) private pure returns (uint8) {
        uint8 charCode = uint8(char);
        if (charCode >= 48 && charCode <= 57) {
            return charCode - 48; // 0-9
        } else if (charCode >= 65 && charCode <= 70) {
            return charCode - 55; // A-F
        } else if (charCode >= 97 && charCode <= 102) {
            return charCode - 87; // a-f
        } else {
            revert("Invalid hex character");
        }
    }
    
    function slash(
        address providerAddr,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        Provider storage provider = providers[providerAddr];
        require(provider.isActive, "Provider not active");
        require(amount <= provider.stakedAmount, "Slash amount too high");
        
        provider.stakedAmount -= amount;
        
        if (provider.stakedAmount < MIN_STAKE) {
            provider.isActive = false;
        }
        
        emit ProviderSlashed(providerAddr, amount, reason);
    }
    
    function updateReputation(address providerAddr, bool success) external onlyOwner {
        Provider storage provider = providers[providerAddr];
        require(provider.isActive, "Provider not active");
        
        provider.totalJobs++;
        if (success) {
            provider.successfulJobs++;
            provider.reputation = (provider.reputation * 95 + 105) / 100; // Slight boost
        } else {
            provider.reputation = (provider.reputation * 98) / 100; // Slight penalty
        }
    }
    
    function getActiveProviders() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < providerList.length; i++) {
            if (providers[providerList[i]].isActive && 
                block.timestamp - providers[providerList[i]].lastHeartbeat < HEARTBEAT_TIMEOUT) {
                activeCount++;
            }
        }
        
        address[] memory active = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < providerList.length; i++) {
            address providerAddr = providerList[i];
            if (providers[providerAddr].isActive && 
                block.timestamp - providers[providerAddr].lastHeartbeat < HEARTBEAT_TIMEOUT) {
                active[index] = providerAddr;
                index++;
            }
        }
        
        return active;
    }
}