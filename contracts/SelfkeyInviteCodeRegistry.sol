// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./external/ISelfkeyMintableRegistry.sol";
import "./external/ISelfkeyUnclaimedRegistry.sol";
import "./external/ISelfkeyIdAuthorization.sol";

struct UserInvitationInfo {
    address user;
    string code;
    bool used;
}

contract SelfkeyInviteCodeRegistry is Initializable, OwnableUpgradeable {

    event AuthorizedSignerChanged(address indexed _address);
    event InvitationCodeAdded(address indexed _address, string _code);
    event InvitationCodeUsed(address indexed _address, address indexed _inviter, string _code);

    address public authorizedSigner;
    mapping(address => UserInvitationInfo) private _userInvitationInfo;
    mapping(string => address) private _userInvitationCode;

    ISelfkeyMintableRegistry public mintableRegistryContract;
    ISelfkeyUnclaimedRegistry public unclaimedRegistryContract;
    ISelfkeyIdAuthorization public authorizationContract;

    event AuthorizationContractAddressChanged(address _newAuthorizationContractAddress);
    event MintableRegistryContractAddressChanged(address _newMintableRegistryContractAddress);
    event UnclaimedRegistryContractAddressChanged(address _newUnclaimedRegistryContractAddress);

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

    function getInviteCode(address _address) public virtual view returns (string memory) {
        string memory _code = string(_userInvitationInfo[_address].code);
        return _code;
    }

    function getInviteCodeOwner(string memory _code) public virtual view returns (address) {
        return _userInvitationCode[_code];
    }

    function registerInviteCode(address _address, string memory _code) external {
        require(msg.sender == authorizedSigner, "Invalid signer");
        require(_userInvitationInfo[_address].user == address(0), "Already registered");

        UserInvitationInfo memory _invitationInfo = UserInvitationInfo({
            user: _address,
            code: _code,
            used: false
        });

        _userInvitationInfo[_address] = _invitationInfo;
        _userInvitationCode[_code] = _address;

        emit InvitationCodeAdded(_address, _code);
    }

    function registerInviteCodeUsed(address _address, string memory _code) external {
        require(msg.sender == authorizedSigner, "Invalid signer");

        UserInvitationInfo memory existingOwner = _userInvitationInfo[_address];
        require(existingOwner.used == false, "Already redeemed invite code");
        require(existingOwner.user != address(0), "Address not found");
        address _inviter = _userInvitationCode[_code];
        require(_inviter != address(0), "Invalid code");

        _userInvitationInfo[_address].used = true;

        emit InvitationCodeUsed(_address, _inviter, _code);
    }

    function isInviteUsed(address _address) public virtual view returns (bool) {
        UserInvitationInfo memory _userInfo = _userInvitationInfo[_address];
        return _userInfo.used;
    }

    function isInviteCodeValid(string memory _inviteCode) public virtual view returns (bool) {
        address _inviterAddress = _userInvitationCode[_inviteCode];
        return _inviterAddress != address(0);
    }

    function setAuthorizationContractAddress(address _newAuthorizationContractAddress) public onlyOwner {
        authorizationContract = ISelfkeyIdAuthorization(_newAuthorizationContractAddress);
        emit AuthorizationContractAddressChanged(_newAuthorizationContractAddress);
    }

    function setMintableRegistryContractAddress(address _newMintableRegistryContractAddress) public onlyOwner {
        mintableRegistryContract = ISelfkeyMintableRegistry(_newMintableRegistryContractAddress);
        emit MintableRegistryContractAddressChanged(_newMintableRegistryContractAddress);
    }

    function setUnclaimedRegistryContractAddress(address _newUnclaimedRegistryContractAddress) public onlyOwner {
        unclaimedRegistryContract = ISelfkeyUnclaimedRegistry(_newUnclaimedRegistryContractAddress);
        emit UnclaimedRegistryContractAddressChanged(_newUnclaimedRegistryContractAddress);
    }

    function registerInviteCodeUsedWithAward(address _address, string memory _code, uint _amount, string memory _title, uint256 _taskId, address _relyingParty) external {
        require(msg.sender == authorizedSigner, "Invalid signer");

        UserInvitationInfo memory existingOwner = _userInvitationInfo[_address];
        require(existingOwner.used == false, "Already redeemed invite code");
        require(existingOwner.user != address(0), "Address not found");

        address _inviter = _userInvitationCode[_code];
        require(_inviter != address(0), "Invalid code");

        // Add to the mintable Registry
        mintableRegistryContract.register(_address, _amount, _title, _taskId, authorizedSigner);

        unclaimedRegistryContract.registerReward(_inviter, _amount, _title, _relyingParty, authorizedSigner);

        _userInvitationInfo[_address].used = true;

        emit InvitationCodeUsed(_address, _inviter, _code);
    }

    function selfRegisterInviteCodeUsed(address _address, string memory _code, uint _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory signature) external {
        UserInvitationInfo memory existingOwner = _userInvitationInfo[_address];

        require(existingOwner.used == false, "Already redeemed invite code");
        require(existingOwner.user != address(0), "Address not found");

        address _inviter = _userInvitationCode[_code];
        require(_inviter != address(0), "Invalid code");

        // Verify payload
        authorizationContract.authorize(address(this), _address, _amount, 'selfkey.invite.reward', _param, _timestamp, _signer, signature);

        // Add to the mintable Registry
        mintableRegistryContract.register(_address, _amount, 'selfkey.invite.reward', 1, _signer);

        // Add to the unclaimed Registry
        unclaimedRegistryContract.registerReward(_inviter, _amount, 'Invite Reward', _signer, _signer);

        _userInvitationInfo[_address].used = true;

        emit InvitationCodeUsed(_address, _inviter, _code);
    }
}
