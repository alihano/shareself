// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../BondingCurve.sol";

/// @notice Test-only wrapper exposing BondingCurve's internal library functions
///         externally, since Hardhat tests can't call `internal` functions directly.
contract BondingCurveHarness {
    function getPrice(uint256 supply) external pure returns (uint256) {
        return BondingCurve.getPrice(supply);
    }

    function getBuyPrice(uint256 supply, uint256 amount) external pure returns (uint256) {
        return BondingCurve.getBuyPrice(supply, amount);
    }

    function getSellPrice(uint256 supply, uint256 amount) external pure returns (uint256) {
        return BondingCurve.getSellPrice(supply, amount);
    }
}
