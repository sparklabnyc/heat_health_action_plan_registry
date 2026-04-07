// Helper: detect which page we are on
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("plansTable")) {
    initTableView();
  }
  if (document.getElementById("map")) {
    initMapView();
  }
});

// Fetch the master index
function fetchPlansIndex() {
  return fetch("plans_index.json?ts=" + Date.now())
    .then(res => res.json())
    .catch(err => {
      console.error("Error loading plans_index.json:", err);
      return [];
    });
}

// TABLE VIEW
function initTableView() {
  const tableBody = document.querySelector("#plansTable tbody");
  const searchInput = document.getElementById("searchInput");
  const countryFilter = document.getElementById("countryFilter");

  fetchPlansIndex().then(data => {
    let plans = data || [];

    // populate country filter options
    const countries = Array.from(
      new Set(plans.map(p => p.country).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    countries.forEach(country => {
      const opt = document.createElement("option");
      opt.value = country;
      opt.textContent = country;
      countryFilter.appendChild(opt);
    });

    // sort plans by country before rendering
    plans.sort((a, b) => {
      const cA = (a.country || "").toLowerCase();
      const cB = (b.country || "").toLowerCase();
      return cA.localeCompare(cB);
    });

    // render initial table
    renderTable(plans, tableBody);

    // search + filter handlers
    function applyFilters() {
      const searchTerm = searchInput.value.toLowerCase().trim();
      const selectedCountry = countryFilter.value;

      const filtered = plans.filter(plan => {
        if (selectedCountry && plan.country !== selectedCountry) return false;

        const haystack = [
          plan.title,
          plan.country,
          plan.region,
          plan.city,
          plan.year
        ]
          .map(v => (v || "").toString().toLowerCase())
          .join(" ");

        if (searchTerm && !haystack.includes(searchTerm)) return false;
        return true;
      });

      renderTable(filtered, tableBody);
    }

    searchInput.addEventListener("input", applyFilters);
    countryFilter.addEventListener("change", applyFilters);
  });
}

function renderTable(plans, tableBody) {
  tableBody.innerHTML = "";

  const plansByCountry = {};
  plans.forEach(plan => {
    const country = plan.country || "Unknown";
    if (!plansByCountry[country]) plansByCountry[country] = [];
    plansByCountry[country].push(plan);
  });

  const sortedCountries = Object.keys(plansByCountry).sort((a, b) =>
    a.localeCompare(b)
  );

  sortedCountries.forEach(country => {
    const countryPlans = plansByCountry[country];

    const headerRow = document.createElement("tr");
    headerRow.className = "country-header-row";
    const headerCell = document.createElement("td");
    headerCell.colSpan = 6;
    headerCell.innerHTML = `<strong>${country}</strong>`;
    headerRow.appendChild(headerCell);
    tableBody.appendChild(headerRow);

    countryPlans.forEach(plan => {
      const tr = document.createElement("tr");

      const titleTd = document.createElement("td");
      titleTd.textContent = plan.title || "";

      const countryTd = document.createElement("td");
      countryTd.textContent = plan.country || "";

      const regionTd = document.createElement("td");
      regionTd.textContent = plan.region || "";

      const cityTd = document.createElement("td");
      cityTd.textContent = plan.city || "";

      const yearTd = document.createElement("td");
      yearTd.textContent = plan.year || "";

      const linkTd = document.createElement("td");
      const link = determinePlanLink(plan);
      if (link) {
        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "plan-link-btn";
        a.textContent = "Open plan";
        linkTd.appendChild(a);
      } else {
        linkTd.textContent = "No link available";
      }

      tr.appendChild(titleTd);
      tr.appendChild(countryTd);
      tr.appendChild(regionTd);
      tr.appendChild(cityTd);
      tr.appendChild(yearTd);
      tr.appendChild(linkTd);
      tableBody.appendChild(tr);
    });
  });
}

function determinePlanLink(plan) {
  if (plan.url && plan.url.startsWith("http")) return plan.url;
  if (plan.pdf_link && plan.pdf_link.startsWith("http")) return plan.pdf_link;
  if (plan.pdf_drive_link && plan.pdf_drive_link.startsWith("http")) return plan.pdf_drive_link;
  return null;
}

// ── MAP VIEW ────────────────────────────────────────────────────────────────

function getPlanLevel(plan) {
  if (plan.city && plan.city.toString().trim() !== "") return "city";
  if (plan.region && plan.region.toString().trim() !== "") return "region";
  return "country";
}

function parseCoords(locationStr) {
  if (!locationStr) return null;
  const parts = locationStr.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
  return null;
}

// Colored circle markers using Leaflet's CircleMarker
const MARKER_STYLES = {
  country: { color: "#1565C0", fillColor: "#1E88E5", label: "National plan" },
  region:  { color: "#2E7D32", fillColor: "#43A047", label: "Regional plan" },
  city:    { color: "#B71C1C", fillColor: "#E53935", label: "City plan"     }
};

function createCircleMarker(coords, level) {
  const style = MARKER_STYLES[level];
  return L.circleMarker(coords, {
    radius: level === "city" ? 7 : level === "region" ? 8 : 9,
    color: style.color,
    fillColor: style.fillColor,
    fillOpacity: 0.85,
    weight: 1.5
  });
}

function createPopupHtml(plan) {
  const level = getPlanLevel(plan);
  const levelLabels = { country: "National", region: "Regional", city: "City" };
  const link = determinePlanLink(plan);
  const location = [plan.city, plan.region, plan.country].filter(Boolean).join(", ");

  return `
    <div style="max-width: 240px; font-family: sans-serif; font-size: 13px; line-height: 1.5;">
      <strong style="font-size: 14px;">${plan.title || "Unnamed plan"}</strong><br>
      <span style="color: #666;">${location}</span><br>
      <span style="color: #666;">Year: ${plan.year || "—"}</span><br>
      ${plan.organization ? `<span style="color: #666;">Org: ${plan.organization}</span><br>` : ""}
      <span style="
        display: inline-block;
        margin-top: 4px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        background: ${MARKER_STYLES[level].fillColor};
        color: white;
      ">${levelLabels[level]}</span>
      ${link ? `<br><a href="${link}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block; margin-top:6px; color: #1565C0;">Open plan →</a>` : ""}
    </div>
  `;
}

function addLegend(map) {
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div");
    div.style.cssText = `
      background: white;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-family: sans-serif;
      font-size: 13px;
      line-height: 2;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    `;
    div.innerHTML = Object.entries(MARKER_STYLES).map(([, s]) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="
          display:inline-block; width:12px; height:12px;
          border-radius:50%;
          background:${s.fillColor};
          border: 1.5px solid ${s.color};
        "></span>
        ${s.label}
      </div>
    `).join("");
    return div;
  };
  legend.addTo(map);
}

function initMapView() {
  fetchPlansIndex().then(plans => {
    const map = L.map("map").setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 10,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    plans.forEach(plan => {
      const coords = parseCoords(plan.location);
      if (!coords) return;

      const level = getPlanLevel(plan);
      const marker = createCircleMarker(coords, level);
      marker.bindPopup(createPopupHtml(plan));
      marker.addTo(map);
    });

    addLegend(map);
  });
}
