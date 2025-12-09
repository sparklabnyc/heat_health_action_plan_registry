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
  return fetch("plans_index.json")
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
          plan.organization,
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

  plans.forEach(plan => {
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

    const orgTd = document.createElement("td");
    orgTd.textContent = plan.organization || "";

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
    tr.appendChild(orgTd);
    tr.appendChild(linkTd);

    tableBody.appendChild(tr);
  });
}

// determine which link to use for the plan
function determinePlanLink(plan) {
  // Prefer url if present; otherwise fall back to pdf_drive_link
  if (plan.url && plan.url.startsWith("http")) {
    return plan.url;
  }
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
      "USA": [37.8, -96.9],
      "United States": [37.8, -96.9],
      "Mexico": [23.6, -102.5],
      "Canada": [56.1, -106.3],
      "United Kingdom": [55.3, -3.4],
      "UK": [55.3, -3.4],
      "South Africa": [-30.6, 22.9],
      "India": [20.6, 78.9],
      "Australia": [-25.3, 133.8],
      // Add more as you collect plans
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
