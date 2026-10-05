# Collections

Each folder here is one collection on the [Collections page](https://jacklee981229.github.io/collections/): `movies`, `games`, and any you add. A folder holds one list, `index.yaml`, with the items' pictures beside it.

## Add an item

1. Optional: put its pictures in the collection's folder, such as `movies/my-favourite-film.jpg` and
   `movies/my-favourite-film-2.jpg`.
2. Add the item to that folder's `index.yaml`, under `items:`. Mind the spaces at the start of each line:

   ```yaml
     - name: My Favourite Film
       stars: 4.5
       image: my-favourite-film.jpg
       gallery: [my-favourite-film-2.jpg, my-favourite-film-3.jpg]
   ```

3. Run `npm run dev` and open http://localhost:4321/collections/ to see it.

The rules:

- **Order:** items show in the order they're listed. Move the lines to move an item.
- **Stars:** from 1 to 5, halves allowed: `4` or `4.5`.
- **Picture:** a `.jpg`, `.jpeg`, `.png` or `.webp` file, named exactly as the file is, capital letters included. Leave the `image:` line out and the item gets a plain cover with its name.
- **Picture shape:** on the board every cover is shown as a poster, 2 wide by 3 tall, so a wider picture loses its sides there. Any size works: the site makes its own smaller copies.
- **Gallery:** a click on an item opens its gallery: its `image:` first, then the pictures its `gallery:` lists, in that order, each keeping its own shape (wide pictures too). Leave the `gallery:` line out and the gallery shows the cover alone. The same rules as the cover's picture apply to each one.
- **A name with a colon or a `#`** goes in quotes: `name: "Part Two: The Return"`.

A mistake stops the build with a message that names the item: stars out of range, a picture that isn't there, or a picture of another type.

## Add a collection

Make a folder (its name becomes the link to its tab, such as `/collections/#books`) with an `index.yaml` in it:

```yaml
name: Books
order: 3

items:
  - name: The first book
    stars: 5
```

Each collection is a tab on the page. Tabs show lowest `order` first; ones without an `order` come after, by name.

## Remove one

Delete the item's lines and its picture, or the whole folder for a collection.
