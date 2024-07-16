const express = require('express');
const app = express();
const mysql = require('mysql2');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'MYDB'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

const getPokemonsFromAPI = async () => {
  console.log('Fetching list of Pokémon...');
  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=25');
  const data = await response.json();
  console.log('Pokémon list fetched:', data.results);
  return data.results.map((pokemon, index) => ({
    id: index + 1,
    name: pokemon.name
  }));
};

const getPokemonDetailsFromAPI = async (id) => {
  console.log(`Fetching details for Pokémon ID: ${id}...`);
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data = await response.json();
  console.log(`Details fetched for Pokémon ID: ${id}:`, data);
  return {
    id: id,
    name: data.name,
    ability: data.abilities[0].ability.name,
    type: data.types[0].type.name
  };
};

app.get('/', async (req, res) => {
  try {
    const pokemons = await getPokemonsFromAPI();
    const pokemonDetailsPromises = pokemons.map(pokemon => getPokemonDetailsFromAPI(pokemon.id));
    const pokemonDetails = await Promise.all(pokemonDetailsPromises);

    let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pokémon Captura</title></head><body>';
    html += '<h1>¡Pokémon Atrápalos ya!</h1><table><thead><tr><th>ID</th><th>Nombre</th><th>Habilidad</th><th>Tipo</th><th>Atrápalo</th></tr></thead><tbody>';

    for (const pokemon of pokemonDetails) {
      const query = `SELECT * FROM POKEMON WHERE NOMBRE = '${pokemon.name}'`;
      const results = await new Promise((resolve, reject) => {
        connection.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      const isRegistered = results.length > 0;
      const buttonState = isRegistered ? 'Registrado' : 'Pokeball';
      html += `<tr><td>${pokemon.id}</td><td>${pokemon.name}</td><td>${pokemon.ability}</td><td>${pokemon.type}</td><td><button id="button-${pokemon.id}" data-id="${pokemon.id}" class="${buttonState === 'Registrado' ? 'registered' : 'pokeball'}">${buttonState}</button></td></tr>`;
      console.log(`Pokémon: ${pokemon.name}, Habilidad: ${pokemon.ability}, Tipo: ${pokemon.type}`);
    }

    html += '</tbody></table><button id="captureAll">Atrapar</button>';
    html += `<script>
      document.addEventListener('DOMContentLoaded', () => {
        const buttons = document.querySelectorAll('.pokeball');

        buttons.forEach(button => {
          button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            console.log('Botón cambiado a Lanzar para el Pokémon ID:', id);
            button.textContent = 'Lanzar';
            button.classList.remove('pokeball');
            button.classList.add('launch');
          });
        });

        document.getElementById('captureAll').addEventListener('click', async () => {
          const launchButtons = document.querySelectorAll('.launch');
          for (const button of launchButtons) {
            const id = button.dataset.id;
            const response = await fetch('/capture', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ id }),
            });
            const data = await response.json();
            if (data.success) {
              button.textContent = 'Registrado';
              button.classList.remove('launch');
              button.classList.add('registered');
              button.disabled = true;
            } else {
              console.error('Error:', data.error);
            }
          }
        });
      });
    </script></body></html>`;
    res.send(html);
  } catch (error) {
    console.error('Error fetching Pokémon data:', error);
    res.status(500).send('Error fetching Pokémon data');
  }
});

app.post('/capture', (req, res) => {
  const { id } = req.body;
  getPokemonDetailsFromAPI(id)
    .then(pokemon => {
      console.log(`Capturando Pokémon: ${pokemon.name}, Habilidad: ${pokemon.ability}, Tipo: ${pokemon.type}`);
      const query = `INSERT INTO POKEMON (ID, NOMBRE, HABILIDAD_ID, TIPO_ID) VALUES (${id}, '${pokemon.name}', (SELECT HABILIDAD_ID FROM HABILIDAD WHERE NOMBRE='${pokemon.ability}'), (SELECT TIPO_ID FROM TIPO WHERE NOMBRE='${pokemon.type}'))`;
      connection.query(query, (err, results) => {
        if (err) {
          console.error('Error inserting data:', err);
          res.json({ success: false, error: err.message });
        } else {
          res.json({ success: true, data: { id, name: pokemon.name } });
        }
      });
    })
    .catch(error => {
      console.error('Error fetching Pokémon details:', error);
      res.json({ success: false, error: error.message });
    });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
