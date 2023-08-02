import { io } from 'socket.io-client';
import './App.css';
import { useEffect, useState } from 'react';
import {
  Grid, InputLabel, MenuItem, Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

function App() {
  const [prices, setPrices] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [pairFilter, setPairFilter] = useState();

  useEffect(() => {
    const socket = io('ws://localhost:3000', {
      reconnectionDelayMax: 10000,
    });
    socket.connect();
    if (pairFilter) {
      socket.emit('filter', [pairFilter]);
    }
    socket.once('pairs', (pairs) => {
      setPairs(pairs);
    });
    socket.on('prices', (prices) => {
      setPrices(prices);
    });

    return () => {
      socket.disconnect();
    };
  }, [pairFilter]);

  return (
    <Grid container flexDirection='column' className='App'>
      <Grid item>
        <InputLabel id='pair-select-label'>Pairs</InputLabel>
        <Select
          labelId='pair-select-label'
          id='pair-select'
          value={pairFilter}
          onChange={(event) => setPairFilter(event.target.value)}
          sx={{
            minWidth: '300px',
          }}
        >
          {pairs.map((it, index) => (
            <MenuItem key={`token0-${it}-${index}`} value={it}>{it}</MenuItem>
          ))}
        </Select>
      </Grid>
      <Grid item>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Index</TableCell>
                <TableCell>Pair</TableCell>
                <TableCell>Token0 price</TableCell>
                <TableCell>Token1 price</TableCell>
                <TableCell>Reserve0</TableCell>
                <TableCell>Reserve1</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prices.map(([pair, price], index) => (
                <TableRow key={`${pair}-${index}`}>
                  <TableCell>{index}</TableCell>
                  <TableCell>{pair}</TableCell>
                  <TableCell>{price.token0Price}</TableCell>
                  <TableCell>{price.token1Price}</TableCell>
                  <TableCell>{price.reserve0}</TableCell>
                  <TableCell>{price.reserve1}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}

export default App;
