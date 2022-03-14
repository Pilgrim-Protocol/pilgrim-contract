// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

import "../core/libraries/LibAppStorage.sol";
import "../core/libraries/LibBidderQueue.sol";
import "../core/libraries/LibGetters.sol";

import "../token/interfaces/IPilgrimMetaNFT.sol";
import "../core/interfaces/external/INonfungiblePositionManager.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NewCoreFacet {
    AppStorage internal s;

    event Test3(address _b);

    event List(address _nftAddress, uint256 _tokenId, uint256 _version, uint256 _metaNftId, string[] _tags);

    function test1() external pure returns (uint256 _a) {
        _a = 1;
    }

    function test2() external view returns (address _a) {
        _a = s.metaNFT;
    }

    function test3(address _a) external returns (address _b) {
        s.metaNFT = _a;
        _b = s.metaNFT;
        emit Test3(_b);
    }

    function quoteNft(
        uint256 _metaNftId
    ) public view returns (
        uint128 _amountIn,
        uint128 _amountToMNftHolder,
        uint128 _amountToRHolderPR
    ) {
        (_amountIn, _amountToMNftHolder, _amountToRHolderPR) = (100, 100, 100);
    }

    function list(
        address _nftAddress,
        uint256 _tokenId,
        uint128 _initPrice,
        address _baseToken,
        string[] calldata _tags,
        bytes32 _descriptionHash
    ) external {
        require(_initPrice > 0, "Pilgrim: ZERO_INIT_PRICE");
        require(_nftAddress != address(0), "Pilgrim: ZERO_ADDRESS");
        IERC721(_nftAddress).safeTransferFrom(msg.sender, address(this), _tokenId);

        /// Valid base token must have a distribution pool with positive rewardParameter.
        require(s.distPools[_baseToken].rewardParameter > 0, "Pilgrim: INVALID_BASE_TOKEN");

        IPilgrimMetaNFT metaNFT = IPilgrimMetaNFT(s.metaNFT);
        uint256 metaNftId = metaNFT.safeMint(msg.sender);

        uint256[] storage pairVersions = s.metaNftIds[_nftAddress][_tokenId];
        pairVersions.push(metaNftId);
        uint32 version = uint32(pairVersions.length - 1);

        PairInfo storage pairInfo = s.pairs[metaNftId];
        pairInfo.nftAddress = _nftAddress;
        pairInfo.tokenId = _tokenId;
        pairInfo.version = version;
        pairInfo.metaNftId = metaNftId;
        pairInfo.baseToken = _baseToken;
        pairInfo.descriptionHash = _descriptionHash;
        pairInfo.initBaseReserve = _initPrice * (INITIAL_ROUNDS / 1 ether);

        pairInfo.roundTotalSupply += INITIAL_ROUNDS;
        pairInfo.roundBalanceOf[address(this)] += INITIAL_ROUNDS;

        pairInfo.activated = true;

        LibBidderQueue._init(pairInfo.nftQueue);
        LibBidderQueue._init(pairInfo.metaNftQueue);

        if (_nftAddress == s.uniV3Pos) {
            (,,address token0, address token1,,,,,,,,) = INonfungiblePositionManager(s.uniV3Pos).positions(_tokenId);
            pairInfo.extraRewardParameter = LibGetters._getUniV3ExtraRewardParam(token0, token1);
        }
        if (pairInfo.extraRewardParameter == 0) {
            pairInfo.extraRewardParameter = 1;
        }

        for (uint256 i = 0; i < _tags.length; i++) {
            pairInfo.tags.push(_tags[i]);
        }

        emit List(address(0), _tokenId, version, metaNftId, _tags);
    }
}
