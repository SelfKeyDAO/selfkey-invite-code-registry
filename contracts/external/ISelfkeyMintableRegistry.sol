// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

interface ISelfkeyMintableRegistry {
    event AuthorizedSignerChanged(address indexed _address);
    event RewardRegistered(address indexed _account, uint _amount, string _task, uint _task_id);
    event MintingRegistered(address indexed _account, uint _amount);
    event AuthorizedCallerAdded(address indexed _address);
    event AuthorizedCallerRemoved(address indexed _address);

    function changeAuthorizedSigner(address _signer) external;
    function registerReward(address _account, uint256 _amount, string memory _task, uint _task_id, address _signer) external;
    function registerMinting(address _account, uint256 _amount) external;
    function earned(address _account) external view returns(uint);
    function minted(address _account) external view returns(uint);
    function balanceOf(address _account) external view returns(uint);
    function addAuthorizedCaller(address _caller) external;
    function removeAuthorizedCaller(address _caller) external;
    function register(address _account, uint256 _amount, string memory _task, uint _task_id, address _signer) external;
}
