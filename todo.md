## OpenCircuit Roadmap (remaining items)

The following items are pending implementation beyond the current PR (which covers 1–5):

6. **Memory Primitives (RAM/ROM)**
   - Backed by `Uint8Array`, support load/save, and a popup Hex Editor for viewing/editing contents.
   - ROM load from file/assembler output; RAM runtime edits reflected in simulation.

7. **Hierarchical Ports / Parameterized Modules**
   - Add `parameters` object to custom components; support instantiation at variable widths (8/16/32/etc.).
   - Internal generation loops based on parameters; serialization/deserialization updates.

8. **Smart Orthogonal Auto-Routing**
   - Manhattan routing (A* / Lee) to avoid components; reroute on drag; snap to grid.
   - Respect bus widths and reserved keep-outs; minimal bends.

9. **Named Nets (“Wireless” Connections)**
   - Tag wires with net names; wires sharing name are electrically connected without drawings.
   - UI to assign/rename; serialization and probe support.

10. **Design Rule Checks (DRC)**
    - Detect short circuits (multiple drivers), floating inputs, width mismatches, unconnected outputs.
    - Surface warnings with icons and HUD list; jump-to-location.

11. **Integrated Testbench Sequencer**
    - UI panel to script time-based input stimuli and expected outputs.
    - Run/stop, report pass/fail with diff; import/export sequences.

12. **Undo / Redo History Stack**
    - Command pattern covering place/move/delete/wire/connect/props edits.
    - Bounded history with hotkeys; serialization of history optional.

13. **Sub-Circuit “Dive-In” Editing**
    - Double-click custom component to enter its schematic, edit internals, and propagate changes to all instances.
    - Breadcrumb/back navigation; isolation of coordinates.

14. **Conditional Breakpoints**
    - User-defined expressions (e.g., `PC==0xA0`) evaluated each tick; pause when true.
    - UI list to enable/disable; highlight when hit.

15. **Visual FSM Editor**
    - Graph view for states/transitions; edit labels/conditions/actions.
    - “Synthesize” to gates/FFs; round-trip serialization.

16. **Integrated Assembler & Hex Editor**
    - Text editor for ISA definitions (regex-based) and assembly source.
    - Assemble to binary and load into ROM; hex view/editor shares with memory primitive.

17. **Bus Interfaces (Bundling)**
    - Group wires into bundles (e.g., address/data); render as thick cable and allow breakout.
    - Enforce width consistency and propagation.

18. **Interactive Minimap & Smart Zoom**
    - HUD overlay of full map; semantic zoom (simplified rendering when zoomed out).
    - Click/drag to navigate; zoom to selection.

19. **Smart “Spotlight” Search (Ctrl+K)**
    - Command palette to create/find components by ID/type, jump to items, clear board, etc.

20. **Coverage Analysis**
    - Post-sim heatmap: grey (never toggled), green (active), red (high frequency).
    - HUD legend and ability to clear coverage.

21. **Keyboard Shortcut Mapper**
    - Settings UI to rebind defaults (W: Wire, R: Rotate, Del: Remove, Space: Toggle, S: Select, etc.).
    - Persist to storage; export/import mappings.

22. **Miscellaneous Integration**
    - Ensure all above features integrate with serialization, probes, logic analyzer, Verilog export, and DRC.

