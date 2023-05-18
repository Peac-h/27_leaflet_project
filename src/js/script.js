import { leaflet } from "../../node_modules/leaflet/dist/leaflet.js";
import iconLocation from "url:../icons/pin.png";
import iconEdit from "url:../icons/edit.png";
import iconCheck from "url:../icons/check-mark.png";

// Selectors
const saveNoteBtn = document.getElementById("saveNote");
const noteAreaEl = document.getElementById("noteArea");
const notesEl = document.getElementById("notes");
const dateNowEl = document.getElementById("dateNow");
const headTitleEl = document.getElementById("headTitle");
const editHeaderBtn = document.getElementById("editHeaderBtn");
const myLocBtn = document.getElementById("myLoc");
const hUseBtn = document.getElementById("hUse");

// Notes Data
class Note {
  date = new Intl.DateTimeFormat("default", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(new Date());

  id = new Date() * Math.random(7);

  constructor(coords, noteText, marker) {
    this.coords = coords;
    this.noteText = noteText;
    this.marker = marker;
  }
}

// Functionality Architecture
class App {
  #map;
  #mapZoomLevel = 15;
  #mapEvent;
  #notes = [];
  #markers = [];
  #title;

  constructor() {
    // render the map
    this._loadMap();

    //get data from local storage
    this._getLocalStorage();

    // render date
    this._renderDate();
    setInterval(() => this._renderDate(), 1000);

    // attach event handlers
    document.addEventListener("focusin", this._toggleNoteVisibilityOnFocus);
    document.addEventListener("focusout", this._toggleNoteVisibilityOnFocus);
    saveNoteBtn.addEventListener("click", this._newNote.bind(this));
    notesEl.addEventListener("click", this._moveToPopup.bind(this));
    editHeaderBtn.addEventListener("click", this._changeHeadTitle.bind(this));
    myLocBtn.addEventListener("click", this._getPosition.bind(this));
    hUseBtn.addEventListener("click", this._showUse);
  }

  _getPosition() {
    if (navigator.geolocation) {
      // first argument
      navigator.geolocation.getCurrentPosition(
        this._moveToCurrentLoc.bind(this),
        // second argument
        () => {
          alert(
            "Could not get your location. Check your location services and try again later!"
          );
        }
      );
    }
  }

  _renderDate() {
    // render current date above textfield
    dateNowEl.textContent = new Intl.DateTimeFormat("default", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(new Date());
  }

  _loadMap(position = [40.795, -73.957]) {
    let latitude, longitude;

    // getting location from user
    if (position.coords) {
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } else {
      // or using New York coordinats
      latitude = position[0];
      longitude = position[1];
    }

    const coords = [latitude, longitude];

    // render map
    this.#map = L.map("map", { zoomControl: false }).setView(
      coords,
      this.#mapZoomLevel
    );

    L.tileLayer("https://cdn.lima-labs.com/{z}/{x}/{y}.png?api=demo", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on("click", this._startNote.bind(this));

    this.#notes.forEach((note) => {
      this._renderNoteMarker(note);
    });
  }

  _newNote(e) {
    // get data from textarea
    const noteText = noteAreaEl.value;

    if (!noteText) return;

    // get coordinates
    let lat, lng;

    if (this.#mapEvent) {
      lat = this.#mapEvent.latlng.lat;
      lng = this.#mapEvent.latlng.lng;
    } else {
      alert("Choose a location!");
      return;
    }

    let note = new Note([lat, lng], noteText);

    // add new object to notes array
    this.#notes.push(note);

    // render note on map as marker
    this._renderNoteMarker(note);

    // render note on list
    this._renderNote(note);

    // clear text field
    this._clearTextField();

    // clear previous location
    this.#mapEvent = undefined;

    // set local storage to all notes
    this._setLocalStorage();
  }

  _startNote(mapE) {
    // when clicked on the map:

    // coordinates are saved
    this.#mapEvent = mapE;

    // text field is focused
    noteAreaEl.focus();
  }

  _renderNote(note) {
    if (!note) return;

    let markup = `
      <div class="note" data-id="${note.id}">
        <div class="controls">
          <div class="date">${note.date}</div>
          <button id="deleteNote">delete</button>
        </div>
        <div class="note-text">${note.noteText}</div>
      </div>
    `;

    notesEl.insertAdjacentHTML("beforeend", markup);
  }

  _renderNoteMarker(note) {
    // leaflet code
    const myIcon = L.icon({
      iconUrl: iconLocation,
      iconSize: [35, 35],
      iconAnchor: [18, 40],
      popupAnchor: [0, -45],
    });

    const marker = L.marker(note.coords, { icon: myIcon });

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 180,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: "popup",
        })
      )
      .setPopupContent(`Note on ${note.date}`)
      .openPopup();

    note.marker = marker._leaflet_id;

    this.#markers.push(marker);
  }

  _clearTextField() {
    noteAreaEl.value = "";
  }

  _moveToPopup(e) {
    const target = e.target;

    if (target.id === "deleteNote") {
      this._deleteNote(target);
      return;
    }

    const noteEl = e.target.closest(".note");

    if (!noteEl) return;

    const note = this.#notes.find((note) => note.id == noteEl.dataset.id);

    // leaflet code for centering the map

    // solution 1
    // this.#map.setView(note.coords, this.#mapZoomLevel, {
    //   animate: true,
    //   pan: {
    //     duration: 1,
    //   },
    // });

    // solution 2
    this.#map.flyTo(note.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _deleteNote(e) {
    // delete note both from DOM and from the notes array and remove its marker
    const noteEl = e.closest(".note");

    const note = this.#notes.find((note) => note.id == noteEl.dataset.id);

    const noteIndex = this.#notes.findIndex(
      (note) => note.id == noteEl.dataset.id
    );

    const noteMarkerIndex = this.#markers.findIndex(
      (marker) => marker._leaflet_id === note.marker
    );

    this.#notes.splice(noteIndex, 1);

    noteEl.remove();

    this.#map.removeLayer(this.#markers[noteMarkerIndex]);

    this.#markers.splice(noteMarkerIndex, 1);

    this._setLocalStorage();
  }

  _moveToCurrentLoc(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map.flyTo(coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _toggleNoteVisibilityOnFocus() {
    const note = notesEl.querySelectorAll(".note");

    if (document.activeElement === noteAreaEl) {
      note.forEach((note) => note.classList.add("hidden"));
    } else {
      note.forEach((note) => note.classList.remove("hidden"));
    }
  }

  _changeHeadTitle() {
    if (headTitleEl.disabled) {
      headTitleEl.removeAttribute("disabled");
      headTitleEl.focus();
      editHeaderBtn.src = iconCheck;
    } else {
      headTitleEl.setAttribute("disabled", "");
      editHeaderBtn.src = iconEdit;

      this.#title = headTitleEl.value;
      this._setLocalStorage();
    }
  }

  _showUse() {
    const showUseEl = document.getElementById("showUse");
    showUseEl.classList.toggle("show");
  }

  _setLocalStorage() {
    if (this.#notes) localStorage.setItem("notes", JSON.stringify(this.#notes));
    if (this.#title) localStorage.setItem("title", JSON.stringify(this.#title));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("notes"));
    const dataTitle = JSON.parse(localStorage.getItem("title"));

    if (data) {
      this.#notes = data;
      this.#notes.forEach((note) => {
        this._renderNote(note);
        this._renderNoteMarker(note);
      });
    }

    if (dataTitle) {
      this.#title = dataTitle;
      headTitleEl.value = this.#title;
    }
  }

  reset() {
    localStorage.removeItem("notes");
    location.reload();
  }
}

const app = new App();
