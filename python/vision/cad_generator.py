class CADGenerator:
    # Drawing canvas
    CANVAS_W = 800
    CANVAS_H = 600
    MARGIN = 80
    TITLE_H = 80
    
    # Engineering colour palette
    COLORS = {
        "concrete":   "#E8E0D0",
        "steel":      "#B0C4DE",
        "earth":      "#C4A882",
        "water":      "#A8D8EA",
        "masonry":    "#D4A574",
        "void":       "#FFFFFF",
        "ground":     "#8B7355",
        "dimension":  "#CC0000",
        "annotation": "#003366",
        "outline":    "#1A1A1A",
        "centerline": "#0066CC",
        "hatch":      "#666666",
        "background": "#F8F8F0",
        "grid":       "#E8E8E8",
        "title_bg":   "#1A2744",
        "title_text": "#FFFFFF"
    }

    def generate(self, analysis: dict) -> str:
        """Main entry point. Returns complete SVG string."""
        spec = analysis.get("cad_specification", {})
        if not spec:
            return "<svg></svg>"
            
        elements = spec.get("primary_elements", [])
        dims = spec.get("dimensions_to_show", [])
        condition = analysis.get("structural_assessment", {})
        
        svg_parts = []
        svg_parts.append(self._svg_header())
        svg_parts.append(self._drawing_background())
        
        # Structure elements
        for element in elements:
            svg_parts.append(self._draw_element(element))
        
        # Title block
        svg_parts.append(self._draw_title_block(spec.get("title_block", {}), analysis))
        
        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    def _svg_header(self) -> str:
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.CANVAS_W} {self.CANVAS_H}" width="100%" height="100%">'

    def _drawing_background(self) -> str:
        return f'<rect width="{self.CANVAS_W}" height="{self.CANVAS_H}" fill="{self.COLORS["background"]}" />'

    def _scale(self, value: float) -> float:
        # Arbitrary scale for preview
        return value * 100 if value else 0

    def _draw_element(self, element: dict) -> str:
        shape = element.get("shape", "rectangle")
        dims = element.get("dimensions", {})
        pos = element.get("position", {})
        style = element.get("style", {})
        
        x = self.MARGIN + pos.get("x_relative", 0) * (self.CANVAS_W - 2 * self.MARGIN)
        y = self.MARGIN + pos.get("y_relative", 0) * (self.CANVAS_H - 2 * self.MARGIN - self.TITLE_H)
        
        fill = self.COLORS.get(style.get("fill", "concrete"), "#CCCCCC")
        
        if shape == "rectangle":
            w = self._scale(dims.get("width_m", 1))
            h = self._scale(dims.get("height_m", 0.5))
            return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{self.COLORS["outline"]}" stroke-width="2" id="{element.get("element_id", "")}"/>'
            
        elif shape == "circle":
            r = self._scale(dims.get("diameter_m", 1) / 2)
            return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{self.COLORS["outline"]}" stroke-width="2" id="{element.get("element_id", "")}"/>'
            
        return ""

    def _draw_title_block(self, title: dict, analysis: dict) -> str:
        y = self.CANVAS_H - self.TITLE_H
        struct_id = analysis.get("structure_identification", {})
        
        return f'''
        <g class="title-block">
          <rect x="0" y="{y}" width="{self.CANVAS_W}" height="{self.TITLE_H}" fill="{self.COLORS["title_bg"]}"/>
          <text x="20" y="{y + 28}" font-size="16" font-weight="bold" font-family="Arial" fill="{self.COLORS["title_text"]}">{struct_id.get("technical_name", "Unknown Structure")}</text>
          <text x="20" y="{y + 50}" font-size="12" font-family="Arial" fill="#AACCEE">{title.get("drawing_title", "Drawing")}</text>
          <text x="{self.CANVAS_W - 160}" y="{y + 38}" font-size="14" font-weight="bold" fill="white">{struct_id.get("category", "").upper()}</text>
        </g>'''
