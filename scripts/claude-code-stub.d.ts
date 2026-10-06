// Just enough of the `claude-code` module for the contract to augment when it
// is typechecked outside a mod (scripts/contract-check.ts).
declare module 'claude-code' {
    interface EngineInterface {}
    interface PluginState {}
}
