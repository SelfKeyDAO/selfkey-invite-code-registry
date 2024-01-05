// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ISelfkeyIdAuthorization.sol";
import "./ISelfkeyMintableRegistry.sol";
import "./ISelfkeyUnclaimedRegistry.sol";

contract SelfkeyUnclaimedRegistry is Initializable, OwnableUpgradeable, ISelfkeyUnclaimedRegistry {

    address public authorizedSigner;
    mapping(address => RewardEntry[]) private _rewardEntries;
    mapping(address => ClaimedEntry[]) private _claimedEntries;

    // an array of authorized addresses
    mapping(address => bool) public authorizedCallers;
    // payload authorization contract
    ISelfkeyIdAuthorization public authorizationContract;
    // mintable registry contract
    ISelfkeyMintableRegistry public mintableRegistryContract;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() public initializer {
        __Ownable_init();
    }

    function changeAuthorizedSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "Invalid authorized signer");
        authorizedSigner = _signer;
        emit AuthorizedSignerChanged(_signer);
    }

    function registerReward(address _account, uint256 _amount, string memory _scope, address _relying_party, address _signer) external onlyAuthorizedCallerOrSigner {
        _rewardEntries[_account].push(RewardEntry(block.timestamp, _amount, _scope, _relying_party, _signer));
        emit RewardRegistered(_account, _amount, _scope, _relying_party);
    }

    function registerClaim(address _account, uint256 _amount, string memory _scope, address _relying_party) external onlyAuthorizedCallerOrSigner {
        require(balanceOf(_account) >= _amount, "Not enough balance");
        _claimedEntries[_account].push(ClaimedEntry(block.timestamp, _amount, _scope, _relying_party));
        emit ClaimRegistered(_account, _amount, _scope, _relying_party);
    }

    function earned(address _account) public view returns(uint) {
        uint _balance = 0;
        RewardEntry[] memory _accountRecords = _rewardEntries[_account];
        for(uint i=0; i<_accountRecords.length; i++) {
            RewardEntry memory _record = _accountRecords[i];
            if (_record.timestamp <= block.timestamp) {
                _balance = _balance + _record.amount;
            }
        }
        return _balance;
    }

    function claimed(address _account) public view returns(uint) {
        uint _balance = 0;
        ClaimedEntry[] memory _accountRecords = _claimedEntries[_account];
        for(uint i=0; i<_accountRecords.length; i++) {
            ClaimedEntry memory _record = _accountRecords[i];
            if (_record.timestamp <= block.timestamp) {
                _balance = _balance + _record.amount;
            }
        }
        return _balance;
    }

    function balanceOf(address _account) public view returns(uint) {
        return earned(_account) - claimed(_account);
    }

    function earnedByScope(address _account, string memory _scope, address _relying_party) public view returns(uint) {
        uint _balance = 0;
        RewardEntry[] memory _accountRecords = _rewardEntries[_account];
        for(uint i=0; i<_accountRecords.length; i++) {
            RewardEntry memory _record = _accountRecords[i];
            if (_record.timestamp <= block.timestamp) {
                if (keccak256(abi.encodePacked(_scope)) == keccak256(abi.encodePacked(_record.scope)) && _relying_party == _record.relying_party) {
                    _balance = _balance + _record.amount;
                }
            }
        }
        return _balance;
    }

    function claimedByScope(address _account, string memory _scope, address _relying_party) public view returns(uint) {
        uint _balance = 0;
        ClaimedEntry[] memory _accountRecords = _claimedEntries[_account];
        for(uint i=0; i<_accountRecords.length; i++) {
            ClaimedEntry memory _record = _accountRecords[i];
            if (_record.timestamp <= block.timestamp) {
                if (keccak256(abi.encodePacked(_scope)) == keccak256(abi.encodePacked(_record.scope)) && _relying_party == _record.relying_party) {
                    _balance = _balance + _record.amount;
                }
            }
        }
        return _balance;
    }

    function balanceOfByScope(address _account, string memory _scope, address _relying_party) public view returns(uint) {
        return earnedByScope(_account, _scope, _relying_party) - claimedByScope(_account, _scope, _relying_party);
    }

    function isContract(address _addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }

    modifier onlyAuthorizedCaller() {
        require(authorizedCallers[msg.sender] && isContract(msg.sender), "Not an authorized caller");
        _;
    }

    modifier onlyAuthorizedCallerOrSigner() {
        require((authorizedCallers[msg.sender] && isContract(msg.sender)) || authorizedSigner == msg.sender, "Not an authorized caller or signer");
        _;
    }

    function addAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = true;
        emit AuthorizedCallerAdded(_caller);
    }

    function removeAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = false;
        emit AuthorizedCallerRemoved(_caller);
    }

    function setAuthorizationContractAddress(address _newAuthorizationContractAddress) public onlyOwner {
        authorizationContract = ISelfkeyIdAuthorization(_newAuthorizationContractAddress);
        emit AuthorizationContractAddressChanged(_newAuthorizationContractAddress);
    }

    function setMintableRegistryContractAddress(address _newMintableRegistryContractAddress) public onlyOwner {
        mintableRegistryContract = ISelfkeyMintableRegistry(_newMintableRegistryContractAddress);
        emit MintableRegistryContractAddressChanged(_newMintableRegistryContractAddress);
    }

    function selfClaim(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory signature) external {
        address _relyingParty = address(uint160(uint256(_param)));

        // Check if authorization contract is set
        require(address(authorizationContract) != address(0), "Authorization contract not set");

        // Check if mintable registry contract is set
        require(address(mintableRegistryContract) != address(0), "Mintable registry contract not set");

        // Verify enough balance exists
        require(balanceOf(_account) >= _amount, "Not enough balance");

        string memory _scope = 'selfkey.self.claim';

        // Verify payload
        authorizationContract.authorize(address(this), _account, _amount, 'selfkey.self.claim', _param, _timestamp, _signer, signature);

        // Add to the mintable Registry
        mintableRegistryContract.register(_account, _amount, _scope, 1, _signer);

        _claimedEntries[_account].push(ClaimedEntry(block.timestamp, _amount, _scope, _relyingParty));

        // Emit the ClaimRegistered event
        emit ClaimRegistered(_account, _amount, _scope, _relyingParty);
    }
}
