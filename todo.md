## OpenCircuit Roadmap (remaining items)

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
   
22. **CLI**
    - Move js code from index.html to main.js. This can be imported by the html but also by cli.js because it contains all the main logic behind opencircuit. So esentially have two ways to run opencircuit: one from console via a node cli and one from the webbrowser.
