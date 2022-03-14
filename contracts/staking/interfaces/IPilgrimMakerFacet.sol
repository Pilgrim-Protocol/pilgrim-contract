// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.9;

/// @title This contract handles rewards for xPIL holders by swapping tokens collected from fees to PILs.
///
/// @author rn.ermaid
///
interface IPilgrimMakerFacet {
    event LogBridgeSet(address indexed from, address indexed to, uint24 fee);
    event LogConvert(
        address indexed server,
        address indexed token,
        uint256 amount,
        uint256 amountPIL
    );
    ///
    /// @notice  Set bridge token used to swap to PIL
    ///
    function setBridge(address from, address to, uint24 fee) external;
    function convertToPIL(address token) external;
    function convertMultipleTokensToPIL(address[] calldata tokens) external;
}
