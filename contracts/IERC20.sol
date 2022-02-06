pragma solidity ^0.8.0;

interface IERC20 {
  /**
     * @dev Returns the amount of tokens owned by `account`.
  */
  function balanceOf(address account) external view returns (uint256);

  /**
    * @dev Moves `amount` tokens from the caller's account to `recipient`.
    *
    * Returns a boolean value indicating whether the operation succeeded.
    *
    * Emits a {Transfer} event.
    */
  function transfer(address recipient, uint256 amount) external returns (bool);

  /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}