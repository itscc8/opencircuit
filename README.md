---

# OpenCircuit

OpenCircuit is a lightweight, high-performance **digital logic simulator** built entirely in vanilla JavaScript and HTML5 Canvas. Designed for modularity and scalability, it supports multi-bit signal processing, custom integrated circuit (IC) creation, and JSON-based project persistence.

## 🚀 Key Features

* **Multi-Bit Bus Support:** Process signals from 1 to 64 bits wide. Includes dedicated **Splitter** and **Merger** components to manage data buses.
* **Custom Chip Creation:** Group individual components into a selection and save them as a reusable **Custom Tool**. This allows for hierarchical design (e.g., building an 8-bit adder from 1-bit full adders).
* **Real-time Simulation:** An iterative propagation engine simulates logic flow with visual feedback on wire states.
* **Canvas-based UI:** A smooth, panning/zoomable workspace with a responsive HUD and context-sensitive menus.
* **Project Portability:** Save and load entire designs via JSON strings or `.json` file uploads.

---

## 🛠 Component Library

| Type | Function |
| --- | --- |
| **Logic Gates** | AND, OR, NOT, NAND, NOR, XOR, XNOR. |
| **I/O** | Clickable toggle inputs (switches) and LED-style outputs. |
| **Busing** | Splitters (one bus to many bits) and Mergers (many bits to one bus). |
| **Custom** | User-defined components saved from active selections. |

---

## 🎮 How to Use

### Basic Controls

* **Left Click + Drag (Empty Space):** Pan around the infinite grid.
* **Left Click (Component):** Toggle Input states or select for dragging.
* **Right Click (Component/Wire):** Open context menu to delete items or configure properties (like bit-width).
* **Drag Port to Port:** Create a connection. Note: **Bit-widths must match** to successfully connect two ports.

### Creating Custom Components

1. Click the **[ ] Select Area** button in the HUD.
2. Drag a selection box over the circuit you wish to encapsulate.
3. Click **+ Save Custom** and give your chip a name.
4. Your new component will appear in the sidebar for reuse!

### Saving & Loading

Open the **Save / Load** menu to generate a JSON representation of your work. You can copy this to your clipboard or download it as a file to resume your design later.

---

## 🧪 Technical Details

The engine uses a **masked BigInt architecture** to handle up to 64-bit logic accurately.

The simulation runs on a localized propagation loop, ensuring that state changes ripple through the circuit for up to 8 iterations per frame to resolve feedback loops and complex logic gates.

---

---

**Would you like me to create a specific "Quick Start" guide or a set of example JSON circuits (like a Half-Adder) that you can include in the repository?**
