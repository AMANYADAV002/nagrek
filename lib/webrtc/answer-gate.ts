/**
 * A local answer is legal only while the remote offer is the current description.
 * `stable` means negotiation already finished; setting an answer there throws InvalidStateError.
 */
export function canApplyLocalAnswer(signalingState: string) {
  return signalingState === "have-remote-offer";
}
