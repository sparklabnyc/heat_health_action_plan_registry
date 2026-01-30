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
        // country filter
        if (selectedCountry && plan.country !== selectedCountry) {
          return false;
        }

        // search across several fields
        const haystack = [
          plan.title,
          plan.country,
          plan.region,
          plan.city,
          plan.year,
          plan.summary
        ]
          .map(v => (v || "").toString().toLowerCase())
          .join(" ");

        if (searchTerm && !haystack.includes(searchTerm)) {
          return false;
        }
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

  // Group plans by country
  const plansByCountry = {};
  plans.forEach(plan => {
    const country = plan.country || "Unknown";
    if (!plansByCountry[country]) {
      plansByCountry[country] = [];
    }
    plansByCountry[country].push(plan);
  });

  // Sort countries alphabetically
  const sortedCountries = Object.keys(plansByCountry).sort((a, b) =>
    a.localeCompare(b)
  );

  sortedCountries.forEach(country => {
    const countryPlans = plansByCountry[country];

    /* ---------- Country header row ---------- */
    const headerRow = document.createElement("tr");
    headerRow.className = "country-header-row";

    const headerCell = document.createElement("td");
    headerCell.colSpan = 6; // match number of columns
    headerCell.innerHTML = `<strong>${country}</strong>`;


    headerRow.appendChild(headerCell);
    tableBody.appendChild(headerRow);

    /* ---------- Plan rows ---------- */
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


// determine which link to use for the plan
function determinePlanLink(plan) {
  // 1️⃣ Prefer URL if provided
  if (plan.url && plan.url.startsWith("http")) {
    return plan.url;
  }

  // 2️⃣ Next: GitHub-hosted PDF uploaded automatically
  if (plan.pdf_link && plan.pdf_link.startsWith("http")) {
    return plan.pdf_link;
  }

  // 3️⃣ Last: Google Drive fallback (old system)
  if (plan.pdf_drive_link && plan.pdf_drive_link.startsWith("http")) {
    return plan.pdf_drive_link;
  }

  return null;
}

// MAP VIEW
function initMapView() {
  fetchPlansIndex().then(plans => {
    // Basic world map centered approx. on 0,0
    const map = L.map("map").setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 6,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Simple country -> lat/lng mapping (extend over time)
    const countryCoords = {
      "Canada": [56.1, -106.3],
      "United States": [37.8, -96.9],
      "USA": [37.8, -96.9],
      "Argentina": [-38.4, -63.6],
      "United Kingdom": [55.3, -3.4],
      "UK": [55.3, -3.4],
      "Ireland": [53.1, -8.2],
      "France": [46.2, 2.2],
      "Germany": [51.2, 10.4],
      "Italy": [41.9, 12.6],
      "Spain": [40.4, -3.7],
      "Portugal": [39.4, -8.2],
      "Netherlands": [52.1, 5.3],
      "Belgium": [50.8, 4.5],
      "Luxembourg": [49.8, 6.1],
      "Switzerland": [46.8, 8.2],
      "Austria": [47.5, 14.6],
      "Sweden": [62.0, 15.0],
      "Lithuania": [55.2, 23.9],
      "North Macedonia": [41.6, 21.7],
      "India": [20.6, 78.9],
      "Pakistan": [30.4, 69.3],
      "Bangladesh": [23.7, 90.4],
      "Nepal": [28.4, 84.1],
      "South Africa": [-30.6, 22.9],
      "Australia": [-25.3, 133.8],
      "New Zealand": [-40.9, 174.9]
    };

    // Group plans by country
    const plansByCountry = {};
    plans.forEach(plan => {
      const c = plan.country || "Unknown";
      if (!plansByCountry[c]) plansByCountry[c] = [];
      plansByCountry[c].push(plan);
    });

    Object.keys(plansByCountry).forEach(country => {
      const coords = countryCoords[country];
      if (!coords) {
        // No coordinates configured for this country yet
        return;
      }

      const plansList = plansByCountry[country];
      const popupHtml = createCountryPopupHtml(country, plansList);

      L.marker(coords)
        .addTo(map)
        .bindPopup(popupHtml);
    });
  });
}

function createCountryPopupHtml(country, plans) {
  let html = `<strong>${country}</strong><br><ul>`;
  plans.forEach(plan => {
    const link = determinePlanLink(plan);
    const safeTitle = plan.title || "Unnamed plan";
    if (link) {
      html += `<li><a href="${link}" target="_blank" rel="noopener noreferrer">${safeTitle}</a></li>`;
    } else {
      html += `<li>${safeTitle} (no link)</li>`;
    }
  });
  html += "</ul>";
  return html;
}
